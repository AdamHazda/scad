import JSZip from 'jszip';

/**
 * Downloads all project source files as a ready-to-use ZIP file for GitHub or hosting.
 */
export async function downloadProjectZip(onProgress?: (msg: string) => void): Promise<void> {
  onProgress?.('Fetching project files...');
  const zip = new JSZip();

  try {
    const res = await fetch('/api/project-files');
    if (res.ok) {
      const data = await res.json();
      const files: Record<string, string> = data.files || {};

      for (const [relativePath, content] of Object.entries(files)) {
        zip.file(relativePath, content);
      }
    } else {
      throw new Error('Server files endpoint not available');
    }
  } catch (e) {
    // Fallback: minimal essential bundle
    onProgress?.('Bundling essential files...');
    zip.file('README.md', '# OpenSCAD Web Studio\n\nRun `npm install` and `npm run dev` to start.\n');
  }

  onProgress?.('Generating ZIP file...');
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openscad-web-studio-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
