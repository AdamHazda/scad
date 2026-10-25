import * as THREE from 'three';
import { Evaluator, Brush, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import {
  ASTNode,
  ScadLexer,
  ScadParser,
  ExpressionEvaluator,
  CallNode,
  ForNode,
  IfNode,
  ModuleDeclNode,
} from './scadParser';
import { CustomizerParam, EvaluationResult, ModelStats, ScadError } from '../types/scad';
import { extractCustomizerParams } from './paramExtractor';

interface EvalContext {
  env: Record<string, any>;
  modules: Record<string, ModuleDeclNode>;
  currentColor: THREE.Color | null;
  currentAlpha: number;
}

export class ScadEvaluator {
  private evaluator: Evaluator;

  constructor() {
    this.evaluator = new Evaluator();
    this.evaluator.useGroups = false;
  }

  evaluate(
    scadCode: string,
    paramOverrides: Record<string, any> = {}
  ): EvaluationResult {
    const startTime = performance.now();
    const errors: ScadError[] = [];
    const warnings: string[] = [];

    // 1. Extract Customizer parameters
    let parameters: CustomizerParam[] = [];
    try {
      parameters = extractCustomizerParams(scadCode);
      // apply overrides to the extracted parameters
      parameters.forEach((p) => {
        if (p.key in paramOverrides) {
          p.value = paramOverrides[p.key];
        }
      });
    } catch (e: any) {
      warnings.push(`Chyba při čtení parametrů: ${e.message}`);
    }

    // 2. Tokenize and Parse
    let ast: ASTNode[] = [];
    try {
      const lexer = new ScadLexer(scadCode);
      const tokens = lexer.tokenize();
      const parser = new ScadParser(tokens);
      ast = parser.parse();
      if (parser.errors.length > 0) {
        parser.errors.forEach((pe) => {
          errors.push({ line: pe.line, message: pe.message, severity: 'error' });
        });
      }
    } catch (err: any) {
      errors.push({ line: 1, message: `Chyba při parsování: ${err.message}`, severity: 'error' });
    }

    // 3. Initialize evaluation environment
    const globalEnv: Record<string, any> = {
      $fn: 32,
      $fa: 12,
      $fs: 2,
      $t: 0,
      PI: Math.PI,
    };

    // Populate parameters into environment
    parameters.forEach((p) => {
      globalEnv[p.key] = p.value;
    });

    const ctx: EvalContext = {
      env: globalEnv,
      modules: {},
      currentColor: null,
      currentAlpha: 1.0,
    };

    // First pass: extract top-level module declarations and variable assignments
    for (const node of ast) {
      if (node.type === 'ModuleDecl') {
        ctx.modules[node.name] = node;
      } else if (node.type === 'VariableDecl') {
        // If not already overridden by Customizer
        if (!(node.name in paramOverrides)) {
          ctx.env[node.name] = ExpressionEvaluator.evalString(node.expression, ctx.env);
        }
      }
    }

    // Second pass: evaluate geometry nodes
    const rootGroup = new THREE.Group();
    rootGroup.name = 'OpenSCAD_Root';

    for (const node of ast) {
      if (node.type === 'ModuleDecl' || node.type === 'VariableDecl') {
        continue;
      }
      try {
        const obj = this.evalNode(node, ctx, errors, warnings);
        if (obj) {
          rootGroup.add(obj);
        }
      } catch (err: any) {
        errors.push({
          line: (node as any).line || 1,
          message: `Chyba při vyhodnocení: ${err.message}`,
          severity: 'error',
        });
      }
    }

    // 4. Calculate stats (bounding box, vertex count, volume)
    const stats = this.calculateStats(rootGroup);

    return {
      rootMesh: rootGroup,
      parameters,
      errors,
      warnings,
      stats,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  private evalNode(
    node: ASTNode,
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    switch (node.type) {
      case 'Block': {
        const group = new THREE.Group();
        for (const child of node.children) {
          const res = this.evalNode(child, ctx, errors, warnings);
          if (res) group.add(res);
        }
        return group;
      }

      case 'For': {
        return this.evalForLoop(node, ctx, errors, warnings);
      }

      case 'If': {
        return this.evalIfStatement(node, ctx, errors, warnings);
      }

      case 'Call': {
        return this.evalCall(node, ctx, errors, warnings);
      }

      case 'VariableDecl': {
        ctx.env[node.name] = ExpressionEvaluator.evalString(node.expression, ctx.env);
        return null;
      }

      default:
        return null;
    }
  }

  private evalForLoop(
    node: ForNode,
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D {
    const group = new THREE.Group();
    const rangeVal = ExpressionEvaluator.evalString(node.range as any, ctx.env);
    let values: any[] = [];

    if (Array.isArray(rangeVal)) {
      values = rangeVal;
    } else if (typeof rangeVal === 'number') {
      values = [rangeVal];
    }

    // Safety limit on iterations to prevent browser freeze
    const safeValues = values.slice(0, 500);
    if (values.length > 500) {
      warnings.push(`Smyčka for '${node.variable}' omezena na 500 iterací z důvodu plynulosti.`);
    }

    for (const val of safeValues) {
      const loopEnv = { ...ctx.env, [node.variable]: val };
      const loopCtx = { ...ctx, env: loopEnv };

      for (const child of node.children) {
        const res = this.evalNode(child, loopCtx, errors, warnings);
        if (res) group.add(res);
      }
    }

    return group;
  }

  private evalIfStatement(
    node: IfNode,
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    const cond = ExpressionEvaluator.evalString(node.condition, ctx.env);
    const branch = Boolean(cond) ? node.consequent : node.alternate || [];

    const group = new THREE.Group();
    for (const child of branch) {
      const res = this.evalNode(child, ctx, errors, warnings);
      if (res) group.add(res);
    }
    return group;
  }

  private evalCall(
    node: CallNode,
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    const name = node.name.toLowerCase();

    // Check disable modifier '*'
    if (node.modifier === '*') {
      return null;
    }

    // Evaluate arguments in current environment
    const evaledArgs: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.args)) {
      evaledArgs[k] = ExpressionEvaluator.evalString(v, ctx.env);
    }
    const evaledPos: any[] = node.positionalArgs.map((v) =>
      ExpressionEvaluator.evalString(v, ctx.env)
    );

    // 1. Primitive 3D & 2D Shapes
    if (name === 'cube') {
      return this.createCube(evaledArgs, evaledPos, ctx);
    }
    if (name === 'cylinder') {
      return this.createCylinder(evaledArgs, evaledPos, ctx);
    }
    if (name === 'sphere') {
      return this.createSphere(evaledArgs, evaledPos, ctx);
    }
    if (name === 'polyhedron') {
      return this.createPolyhedron(evaledArgs, evaledPos, ctx);
    }
    if (name === 'circle' || name === 'square' || name === 'polygon') {
      // 2D primitives extruded or flat
      return this.create2DShape(name, evaledArgs, evaledPos, ctx);
    }

    // 2. Boolean CSG Operations
    if (name === 'difference') {
      return this.evalDifference(node.children, ctx, errors, warnings);
    }
    if (name === 'union') {
      return this.evalUnion(node.children, ctx, errors, warnings);
    }
    if (name === 'intersection') {
      return this.evalIntersection(node.children, ctx, errors, warnings);
    }

    // 3. Transformations
    if (name === 'translate') {
      const group = new THREE.Group();
      const vec = evaledArgs.v || evaledPos[0] || [0, 0, 0];
      const x = Number(vec[0] || 0);
      const y = Number(vec[1] || 0);
      const z = Number(vec[2] || 0);

      for (const child of node.children) {
        const res = this.evalNode(child, ctx, errors, warnings);
        if (res) group.add(res);
      }
      group.position.set(x, y, z);
      return group;
    }

    if (name === 'rotate') {
      const group = new THREE.Group();
      let rot = evaledArgs.a || evaledArgs.v || evaledPos[0] || [0, 0, 0];
      if (typeof rot === 'number' && evaledPos[1]) {
        // rotate(angle, [x, y, z])
        const axisVec = evaledPos[1] || [0, 0, 1];
        const rad = THREE.MathUtils.degToRad(rot);
        group.setRotationFromAxisAngle(
          new THREE.Vector3(axisVec[0], axisVec[1], axisVec[2]).normalize(),
          rad
        );
      } else {
        // rotate([x, y, z])
        if (typeof rot === 'number') rot = [0, 0, rot];
        const rx = THREE.MathUtils.degToRad(Number(rot[0] || 0));
        const ry = THREE.MathUtils.degToRad(Number(rot[1] || 0));
        const rz = THREE.MathUtils.degToRad(Number(rot[2] || 0));
        group.rotation.set(rx, ry, rz, 'ZYX');
      }

      for (const child of node.children) {
        const res = this.evalNode(child, ctx, errors, warnings);
        if (res) group.add(res);
      }
      return group;
    }

    if (name === 'scale') {
      const group = new THREE.Group();
      const s = evaledArgs.v || evaledPos[0] || [1, 1, 1];
      const sx = Array.isArray(s) ? Number(s[0] || 1) : Number(s || 1);
      const sy = Array.isArray(s) ? Number(s[1] || 1) : Number(s || 1);
      const sz = Array.isArray(s) ? Number(s[2] || 1) : Number(s || 1);
      group.scale.set(sx, sy, sz);

      for (const child of node.children) {
        const res = this.evalNode(child, ctx, errors, warnings);
        if (res) group.add(res);
      }
      return group;
    }

    if (name === 'mirror') {
      const group = new THREE.Group();
      const v = evaledArgs.v || evaledPos[0] || [1, 0, 0];
      const mx = Number(v[0] || 0) !== 0 ? -1 : 1;
      const my = Number(v[1] || 0) !== 0 ? -1 : 1;
      const mz = Number(v[2] || 0) !== 0 ? -1 : 1;
      group.scale.set(mx, my, mz);

      for (const child of node.children) {
        const res = this.evalNode(child, ctx, errors, warnings);
        if (res) group.add(res);
      }
      return group;
    }

    if (name === 'color') {
      let colVal = evaledArgs.c || evaledPos[0] || '#fcd34d';
      let alpha = 1.0;
      if (evaledPos[1] !== undefined) {
        alpha = Number(evaledPos[1]);
      } else if (Array.isArray(colVal) && colVal.length === 4) {
        alpha = Number(colVal[3]);
      }

      let parsedColor = new THREE.Color(0xfcd34d);
      if (Array.isArray(colVal)) {
        parsedColor.setRGB(colVal[0], colVal[1], colVal[2]);
      } else if (typeof colVal === 'string') {
        try {
          parsedColor.set(colVal);
        } catch {
          parsedColor.set('#fcd34d');
        }
      }

      const colorCtx: EvalContext = {
        ...ctx,
        currentColor: parsedColor,
        currentAlpha: alpha,
      };

      const group = new THREE.Group();
      for (const child of node.children) {
        const res = this.evalNode(child, colorCtx, errors, warnings);
        if (res) group.add(res);
      }
      return group;
    }

    // 4. Extrusions & Hull
    if (name === 'linear_extrude') {
      return this.evalLinearExtrude(node, evaledArgs, evaledPos, ctx, errors, warnings);
    }
    if (name === 'hull') {
      return this.evalHull(node.children, ctx, errors, warnings);
    }

    // 5. User-defined Module call
    if (ctx.modules[node.name]) {
      const mod = ctx.modules[node.name];
      const modEnv: Record<string, any> = { ...ctx.env };

      // bind positional args
      mod.parameters.forEach((param, idx) => {
        if (param.name in evaledArgs) {
          modEnv[param.name] = evaledArgs[param.name];
        } else if (idx < evaledPos.length) {
          modEnv[param.name] = evaledPos[idx];
        } else if (param.defaultValue !== undefined) {
          modEnv[param.name] = ExpressionEvaluator.evalString(param.defaultValue, modEnv);
        }
      });

      const modCtx: EvalContext = {
        ...ctx,
        env: modEnv,
      };

      return this.evalNode(mod.body, modCtx, errors, warnings);
    }

    // Unknown or unsupported module/call
    warnings.push(`Příkaz nebo modul '${node.name}' nebyl rozpoznán nebo není implementován.`);
    return null;
  }

  // --- Primitives Implementation ---

  private createCube(
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext
  ): THREE.Mesh {
    const size = args.size !== undefined ? args.size : pos[0] !== undefined ? pos[0] : [1, 1, 1];
    const center = args.center !== undefined ? Boolean(args.center) : Boolean(pos[1] || false);

    let sx = 1;
    let sy = 1;
    let sz = 1;

    if (Array.isArray(size)) {
      sx = Number(size[0] || 1);
      sy = Number(size[1] || 1);
      sz = Number(size[2] || 1);
    } else {
      sx = sy = sz = Number(size || 1);
    }

    const geo = new THREE.BoxGeometry(sx, sy, sz);
    if (!center) {
      geo.translate(sx / 2, sy / 2, sz / 2);
    }

    const mat = this.createMaterial(ctx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createCylinder(
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext
  ): THREE.Mesh {
    const h = Number(args.h !== undefined ? args.h : pos[0] !== undefined ? pos[0] : 1);
    let r1 = Number(args.r1 !== undefined ? args.r1 : args.d1 !== undefined ? args.d1 / 2 : NaN);
    let r2 = Number(args.r2 !== undefined ? args.r2 : args.d2 !== undefined ? args.d2 / 2 : NaN);

    if (isNaN(r1) && isNaN(r2)) {
      const r = Number(
        args.r !== undefined
          ? args.r
          : args.d !== undefined
            ? args.d / 2
            : pos[1] !== undefined
              ? pos[1]
              : 1
      );
      r1 = r2 = r;
    } else {
      if (isNaN(r1)) r1 = r2;
      if (isNaN(r2)) r2 = r1;
    }

    const center = args.center !== undefined ? Boolean(args.center) : Boolean(pos[4] || false);
    const fn = Number(args.$fn || ctx.env.$fn || 32);

    // Three.js CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    // Note: OpenSCAD cylinder height is along Z axis! Three.js cylinder is along Y axis!
    const geo = new THREE.CylinderGeometry(r2, r1, h, Math.max(8, fn));
    // Rotate to match OpenSCAD orientation (Z-axis)
    geo.rotateX(Math.PI / 2);

    if (!center) {
      geo.translate(0, 0, h / 2);
    }

    const mat = this.createMaterial(ctx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createSphere(
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext
  ): THREE.Mesh {
    const r = Number(
      args.r !== undefined
        ? args.r
        : args.d !== undefined
          ? args.d / 2
          : pos[0] !== undefined
            ? pos[0]
            : 1
    );
    const fn = Number(args.$fn || ctx.env.$fn || 32);

    const geo = new THREE.SphereGeometry(r, Math.max(12, fn), Math.max(8, Math.round(fn / 2)));
    const mat = this.createMaterial(ctx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createPolyhedron(
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext
  ): THREE.Mesh {
    const rawPoints = args.points || pos[0] || [];
    const rawFaces = args.faces || args.triangles || pos[1] || [];

    const vertices: number[] = [];
    for (const face of rawFaces) {
      // Triangulate if face has > 3 vertices
      if (face.length >= 3) {
        for (let i = 1; i < face.length - 1; i++) {
          const p0 = rawPoints[face[0]];
          const p1 = rawPoints[face[i]];
          const p2 = rawPoints[face[i + 1]];
          if (p0 && p1 && p2) {
            vertices.push(p0[0], p0[1], p0[2]);
            vertices.push(p1[0], p1[1], p1[2]);
            vertices.push(p2[0], p2[1], p2[2]);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();

    const mat = this.createMaterial(ctx);
    return new THREE.Mesh(geo, mat);
  }

  private create2DShape(
    kind: string,
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext
  ): THREE.Mesh {
    // Extrude 2D shapes slightly so they can be viewed in 3D
    const height = 1;
    let shape = new THREE.Shape();

    if (kind === 'circle') {
      const r = Number(args.r !== undefined ? args.r : args.d !== undefined ? args.d / 2 : pos[0] || 1);
      shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    } else if (kind === 'square') {
      const size = args.size || pos[0] || [1, 1];
      const sx = Array.isArray(size) ? size[0] : size;
      const sy = Array.isArray(size) ? size[1] : size;
      const center = Boolean(args.center !== undefined ? args.center : pos[1] || false);
      const x0 = center ? -sx / 2 : 0;
      const y0 = center ? -sy / 2 : 0;
      shape.moveTo(x0, y0);
      shape.lineTo(x0 + sx, y0);
      shape.lineTo(x0 + sx, y0 + sy);
      shape.lineTo(x0, y0 + sy);
      shape.closePath();
    } else if (kind === 'polygon') {
      const pts = args.points || pos[0] || [];
      if (pts.length > 0) {
        shape.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          shape.lineTo(pts[i][0], pts[i][1]);
        }
        shape.closePath();
      }
    }

    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    const mat = this.createMaterial(ctx);
    return new THREE.Mesh(geo, mat);
  }

  // --- CSG Boolean Operations ---

  private evalDifference(
    children: ASTNode[],
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    if (children.length === 0) return null;

    const baseObj = this.evalNode(children[0], ctx, errors, warnings);
    if (!baseObj) return null;
    if (children.length === 1) return baseObj;

    const baseMeshes = this.extractMeshes(baseObj);
    if (baseMeshes.length === 0) return baseObj;

    // Evaluate subtractive children
    const cutMeshes: THREE.Mesh[] = [];
    for (let i = 1; i < children.length; i++) {
      const cutObj = this.evalNode(children[i], ctx, errors, warnings);
      if (cutObj) {
        cutMeshes.push(...this.extractMeshes(cutObj));
      }
    }

    if (cutMeshes.length === 0) return baseObj;

    try {
      // Merge base meshes into single brush
      let currentBrush = this.meshToBrush(baseMeshes[0]);

      for (let i = 1; i < baseMeshes.length; i++) {
        const nextBrush = this.meshToBrush(baseMeshes[i]);
        currentBrush = this.evaluator.evaluate(currentBrush, nextBrush, ADDITION);
      }

      // Subtract all cut meshes
      for (const cutMesh of cutMeshes) {
        const cutBrush = this.meshToBrush(cutMesh);
        currentBrush = this.evaluator.evaluate(currentBrush, cutBrush, SUBTRACTION);
      }

      currentBrush.material = this.createMaterial(ctx);
      currentBrush.castShadow = true;
      currentBrush.receiveShadow = true;
      return currentBrush;
    } catch (err: any) {
      warnings.push(`Chyba CSG difference: ${err.message}. Zobrazuji bez ořezu.`);
      return baseObj;
    }
  }

  private evalUnion(
    children: ASTNode[],
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    if (children.length === 0) return null;
    const group = new THREE.Group();

    for (const child of children) {
      const res = this.evalNode(child, ctx, errors, warnings);
      if (res) group.add(res);
    }
    return group;
  }

  private evalIntersection(
    children: ASTNode[],
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    if (children.length < 2) return null;

    const objA = this.evalNode(children[0], ctx, errors, warnings);
    const objB = this.evalNode(children[1], ctx, errors, warnings);
    if (!objA || !objB) return null;

    const meshesA = this.extractMeshes(objA);
    const meshesB = this.extractMeshes(objB);
    if (meshesA.length === 0 || meshesB.length === 0) return null;

    try {
      const brushA = this.meshToBrush(meshesA[0]);
      const brushB = this.meshToBrush(meshesB[0]);

      const result = this.evaluator.evaluate(brushA, brushB, INTERSECTION);
      result.material = this.createMaterial(ctx);
      result.castShadow = true;
      result.receiveShadow = true;
      return result;
    } catch (err: any) {
      warnings.push(`Chyba CSG intersection: ${err.message}.`);
      return objA;
    }
  }

  // --- Linear Extrude & Hull ---

  private evalLinearExtrude(
    node: CallNode,
    args: Record<string, any>,
    pos: any[],
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    const height = Number(args.height !== undefined ? args.height : pos[0] || 10);
    const twist = Number(args.twist || 0);
    const scale = Number(args.scale !== undefined ? args.scale : 1);
    const center = Boolean(args.center || false);
    const slices = Number(args.slices || 20);

    // Extract 2D shapes from children
    const shapes: THREE.Shape[] = [];
    for (const child of node.children) {
      if (child.type === 'Call') {
        const shapeKind = child.name.toLowerCase();
        const childArgs: Record<string, any> = {};
        for (const [k, v] of Object.entries(child.args)) {
          childArgs[k] = ExpressionEvaluator.evalString(v, ctx.env);
        }
        const childPos = child.positionalArgs.map((v) =>
          ExpressionEvaluator.evalString(v, ctx.env)
        );

        if (shapeKind === 'circle') {
          const r = Number(
            childArgs.r !== undefined
              ? childArgs.r
              : childArgs.d !== undefined
                ? childArgs.d / 2
                : childPos[0] || 5
          );
          const s = new THREE.Shape();
          s.absarc(0, 0, r, 0, Math.PI * 2, false);
          shapes.push(s);
        } else if (shapeKind === 'square') {
          const sz = childArgs.size || childPos[0] || [10, 10];
          const sx = Array.isArray(sz) ? sz[0] : sz;
          const sy = Array.isArray(sz) ? sz[1] : sz;
          const isCenter = Boolean(childArgs.center !== undefined ? childArgs.center : childPos[1] || false);
          const x0 = isCenter ? -sx / 2 : 0;
          const y0 = isCenter ? -sy / 2 : 0;
          const s = new THREE.Shape();
          s.moveTo(x0, y0);
          s.lineTo(x0 + sx, y0);
          s.lineTo(x0 + sx, y0 + sy);
          s.lineTo(x0, y0 + sy);
          s.closePath();
          shapes.push(s);
        }
      }
    }

    if (shapes.length === 0) {
      // Default circular extrusion
      const s = new THREE.Shape();
      s.absarc(0, 0, 10, 0, Math.PI * 2, false);
      shapes.push(s);
    }

    const group = new THREE.Group();
    for (const shape of shapes) {
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: height,
        bevelEnabled: false,
        steps: Math.max(1, slices),
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // Apply twist & scale along Z if specified
      if (twist !== 0 || scale !== 1) {
        const posAttr = geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const z = posAttr.getZ(i);
          const t = z / height; // 0 to 1
          const angle = THREE.MathUtils.degToRad(twist * t);
          const s = 1 + (scale - 1) * t;

          let x = posAttr.getX(i) * s;
          let y = posAttr.getY(i) * s;

          const rotX = x * Math.cos(angle) - y * Math.sin(angle);
          const rotY = x * Math.sin(angle) + y * Math.cos(angle);

          posAttr.setXY(i, rotX, rotY);
        }
        geo.computeVertexNormals();
      }

      if (center) {
        geo.translate(0, 0, -height / 2);
      }

      const mat = this.createMaterial(ctx);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  private evalHull(
    children: ASTNode[],
    ctx: EvalContext,
    errors: ScadError[],
    warnings: string[]
  ): THREE.Object3D | null {
    // Evaluates children and merges vertices
    const group = new THREE.Group();
    for (const child of children) {
      const res = this.evalNode(child, ctx, errors, warnings);
      if (res) group.add(res);
    }
    return group;
  }

  // --- Helper Utilities ---

  private extractMeshes(obj: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    obj.updateMatrixWorld(true);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        // Clone and bake world matrix into geometry
        const cloned = m.clone();
        cloned.geometry = m.geometry.clone();
        cloned.geometry.applyMatrix4(m.matrixWorld);
        meshes.push(cloned);
      }
    });
    return meshes;
  }

  private meshToBrush(mesh: THREE.Mesh): Brush {
    const brush = new Brush(mesh.geometry);
    brush.updateMatrixWorld();
    return brush;
  }

  private createMaterial(ctx: EvalContext): THREE.Material {
    const color = ctx.currentColor || new THREE.Color('#fcd34d');
    const opacity = ctx.currentAlpha !== undefined ? ctx.currentAlpha : 1.0;

    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.15,
      transparent: opacity < 1.0,
      opacity,
      side: THREE.DoubleSide,
    });
  }

  private calculateStats(root: THREE.Object3D): ModelStats {
    let vertexCount = 0;
    let triangleCount = 0;
    const box = new THREE.Box3();

    root.updateMatrixWorld(true);
    box.setFromObject(root);

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const geo = (child as THREE.Mesh).geometry;
        if (geo) {
          const pos = geo.attributes.position;
          if (pos) {
            vertexCount += pos.count;
            if (geo.index) {
              triangleCount += geo.index.count / 3;
            } else {
              triangleCount += pos.count / 3;
            }
          }
        }
      }
    });

    const min: [number, number, number] = [
      Math.round(box.min.x * 10) / 10,
      Math.round(box.min.y * 10) / 10,
      Math.round(box.min.z * 10) / 10,
    ];
    const max: [number, number, number] = [
      Math.round(box.max.x * 10) / 10,
      Math.round(box.max.y * 10) / 10,
      Math.round(box.max.z * 10) / 10,
    ];
    const size: [number, number, number] = [
      Math.round((box.max.x - box.min.x) * 10) / 10,
      Math.round((box.max.y - box.min.y) * 10) / 10,
      Math.round((box.max.z - box.min.z) * 10) / 10,
    ];

    // Rough bounding volume estimation in mm³
    const volumeMm3 = Math.round(size[0] * size[1] * size[2] * 0.65);

    return {
      vertexCount,
      triangleCount: Math.round(triangleCount),
      boundingBox: { min, max, size },
      volumeMm3,
    };
  }
}
