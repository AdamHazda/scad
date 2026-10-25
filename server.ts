import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // AI Endpoint for generating or enhancing OpenSCAD code
  app.post('/api/gemini/scad', async (req, res) => {
    try {
      const { prompt, currentCode, mode = 'generate', clientApiKey } = req.body;

      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured. Please add it to your environment or enter your key in settings.',
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      let systemInstruction = `You are a world-class expert in OpenSCAD 3D parametric modeling.
Your goal is to generate clean, valid, production-ready OpenSCAD (.scad) code.

IMPORTANT RULES:
1. Always define customizable parameters at the top with OpenSCAD Customizer comments:
   /* [Dimensions] */
   width = 60; // [20:1:200]
   height = 35; // [10:1:150]
   wall_thickness = 2.4; // [1.0:0.2:6.0]
   /* [Options] */
   shape_type = "box"; // [box, cylinder, rounded]
   show_lid = true;
   model_color = "#38bdf8"; // [color]
2. Supported syntax:
   - 3D: cube([x,y,z], center=true/false), cylinder(h, r, r1, r2, d, center=true/false, $fn), sphere(r, d, $fn)
   - Transforms: translate([x,y,z]), rotate([x,y,z]), scale([x,y,z]), mirror([x,y,z]), color([r,g,b,a] or "#hex" or "name")
   - CSG: union(), difference(), intersection()
   - 2D & extrude: linear_extrude(height, twist, scale), circle(r, d, $fn), square([x,y], center), polygon(points)
   - Loops & flow: for (i = [start:step:end]), for (x = [a, b, c]), if (cond) { ... } else { ... }
   - Modules: module name(arg1, arg2) { ... }
   - Math: sin, cos, tan, sqrt, pow, abs, min, max, PI.
3. Keep the model sitting on the print bed (Z >= 0) whenever appropriate.
4. Return valid JSON with two fields:
   - "scad": complete OpenSCAD code
   - "explanation": concise explanation of the model and its parameters`;

      let userMessage = '';
      if (mode === 'generate') {
        userMessage = `Create a parametric OpenSCAD model based on this request:\n${prompt}`;
      } else if (mode === 'edit') {
        userMessage = `Here is existing OpenSCAD code:\n\`\`\`openscad\n${currentCode}\n\`\`\`\n\nModify it according to this request:\n${prompt}`;
      } else if (mode === 'add_customizer') {
        userMessage = `Here is existing OpenSCAD code:\n\`\`\`openscad\n${currentCode}\n\`\`\`\n\nAdd rich parametric variables with Customizer annotations (sliders [min:step:max], boolean toggles, sections /* [Section] */).`;
      } else {
        userMessage = prompt;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMessage,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      let responseText = (response.text || '{}').trim();
      // Strip markdown code fences if model returned them
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }

      let parsed: any = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (pe) {
        console.warn('Direct JSON parse failed, extracting fields:', pe);
        parsed = {
          scad: responseText,
          explanation: 'Model generated.',
        };
      }

      return res.json({
        scadCode: parsed.scad || '',
        explanation: parsed.explanation || 'Model generated successfully.',
      });
    } catch (err: any) {
      console.error('Gemini SCAD generation error:', err);
      return res.status(500).json({
        error: err.message || 'Error generating SCAD code.',
      });
    }
  });

  // Endpoint to package all source files for 1-click GitHub download
  app.get('/api/project-files', async (_req, res) => {
    try {
      const fs = await import('fs/promises');
      const files: Record<string, string> = {};

      async function readDirRecursive(dir: string, base = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const relativePath = base ? `${base}/${entry.name}` : entry.name;
          const fullPath = path.join(dir, entry.name);

          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === '.git' ||
            entry.name.startsWith('.env')
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await readDirRecursive(fullPath, relativePath);
          } else if (entry.isFile()) {
            // Read text files
            if (/\.(ts|tsx|js|jsx|json|html|css|md|example)$/.test(entry.name) || entry.name === '.gitignore') {
              const content = await fs.readFile(fullPath, 'utf-8');
              files[relativePath] = content;
            }
          }
        }
      }

      await readDirRecursive(__dirname);
      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server běží na portu ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
