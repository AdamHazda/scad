import { CustomizerParam } from '../types/scad';

/**
 * Extracts OpenSCAD Customizer parameters from the source code.
 * Supports:
 * - Sections: /* [Section Name] * /
 * - Sliders: // [min:max] or // [min:step:max]
 * - Dropdowns: // [val1, val2, val3] or // [val1:Label1, val2:Label2]
 * - Booleans: var = true; or false;
 * - Colors: // [color]
 */
export function extractCustomizerParams(code: string): CustomizerParam[] {
  const params: CustomizerParam[] = [];
  const lines = code.split('\n');

  let currentGroup = 'Hlavní parametry';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex].trim();

    // Check for Section comment /* [Section Name] */
    const sectionMatch = rawLine.match(/\/\*\s*\[(.*?)\]\s*\*\//);
    if (sectionMatch) {
      currentGroup = sectionMatch[1].trim();
      continue;
    }

    // Ignore lines inside Hidden section
    if (currentGroup.toLowerCase() === 'hidden') {
      continue;
    }

    // Match top-level variable assignment: varName = value; // [spec]
    // e.g. width = 50; // [10:100]
    // e.g. show_holes = true;
    // e.g. mode = "gear"; // [gear, pulley, roller]
    const varMatch = rawLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+);(?:\s*\/\/\s*(.*))?$/);
    if (!varMatch) continue;

    const [, varName, rawVal, comment = ''] = varMatch;
    const trimmedVal = rawVal.trim();
    const trimmedComment = comment.trim();

    // Parse the current value
    let parsedVal: any = trimmedVal;
    let type: CustomizerParam['type'] = 'string';
    let min: number | undefined;
    let max: number | undefined;
    let step: number | undefined;
    let options: string[] | undefined;

    // Check if boolean
    if (trimmedVal === 'true' || trimmedVal === 'false') {
      type = 'boolean';
      parsedVal = trimmedVal === 'true';
    } else if (!isNaN(Number(trimmedVal))) {
      type = 'number';
      parsedVal = Number(trimmedVal);
    } else if (
      (trimmedVal.startsWith('"') && trimmedVal.endsWith('"')) ||
      (trimmedVal.startsWith("'") && trimmedVal.endsWith("'"))
    ) {
      type = 'string';
      parsedVal = trimmedVal.slice(1, -1);
      if (trimmedComment.toLowerCase().includes('[color]')) {
        type = 'color';
      }
    }

    // Check comment annotations
    const bracketMatch = trimmedComment.match(/\[(.*?)\]/);
    if (bracketMatch) {
      const inside = bracketMatch[1].trim();

      if (inside.toLowerCase() === 'color') {
        type = 'color';
      } else if (inside.includes(':')) {
        // Range: [min:max] or [min:step:max]
        const parts = inside.split(':').map((p) => Number(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          type = 'number';
          min = parts[0];
          max = parts[1];
          step = (max - min) / 100 <= 1 ? (Number.isInteger(min) && Number.isInteger(max) ? 1 : 0.1) : 1;
        } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          type = 'number';
          min = parts[0];
          step = parts[1];
          max = parts[2];
        }
      } else if (inside.includes(',')) {
        // Dropdown list: [option1, option2, option3]
        type = 'select';
        options = inside.split(',').map((opt) => opt.trim().replace(/^["']|["']$/g, ''));
      }
    }

    // Auto-detect human-readable name from variable name (e.g. wall_thickness -> Wall thickness)
    const humanName = varName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Clean description from comment (without the [bracket] part)
    const description = trimmedComment.replace(/\[.*?\]/, '').trim();

    params.push({
      key: varName,
      name: humanName,
      value: parsedVal,
      defaultValue: parsedVal,
      type,
      min,
      max,
      step,
      options,
      group: currentGroup,
      description: description || undefined,
    });
  }

  return params;
}

/**
 * Replaces or overrides variable assignments in the SCAD code.
 */
export function injectParameters(code: string, overrides: Record<string, any>): string {
  if (!overrides || Object.keys(overrides).length === 0) return code;

  const lines = code.split('\n');
  const modifiedLines = lines.map((line) => {
    const match = line.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([^;]+);(.*)$/);
    if (!match) return line;

    const [, varName, , rest] = match;
    if (varName in overrides) {
      const val = overrides[varName];
      let formattedVal: string;
      if (typeof val === 'string') {
        formattedVal = `"${val}"`;
      } else if (typeof val === 'boolean') {
        formattedVal = val ? 'true' : 'false';
      } else {
        formattedVal = String(val);
      }
      return `${varName} = ${formattedVal};${rest}`;
    }
    return line;
  });

  return modifiedLines.join('\n');
}
