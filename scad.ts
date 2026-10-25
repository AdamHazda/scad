export interface CustomizerParam {
  key: string;
  name: string;
  value: any;
  defaultValue: any;
  type: 'number' | 'boolean' | 'string' | 'color' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
  description?: string;
}

export interface ScadError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ModelStats {
  vertexCount: number;
  triangleCount: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  volumeMm3: number;
}

export interface EvaluationResult {
  rootMesh: any | null; // THREE.Object3D
  parameters: CustomizerParam[];
  errors: ScadError[];
  warnings: string[];
  stats: ModelStats;
  executionTimeMs: number;
}
