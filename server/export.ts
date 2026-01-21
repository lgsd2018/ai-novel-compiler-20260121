import { getProjectById, getProjectDocuments, getExportRecordById, updateExportRecord } from './db';
import { storagePut } from './storage';
import { notifyOwner } from './_core/notification';

/**
 * Generate export file for a project
 */
export async function generateExport(
  projectId: number,
  format: 'pdf' | 'epub' | 'word' | 'html',
  userId: number,
  recordId: number
): Promise<{ fileUrl: string; fileKey: string; fileSize: number }> {
  try {
    // Get project and documents
    const project = await getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const documents = await getProjectDocuments(projectId);
    
    // Combine all chapter content
    const chapters = documents.filter(doc => doc.type === 'chapter');
    let content = `# ${project.title}\n\n`;
    
    if (project.description) {
      content += `${project.description}\n\n`;
    }
    
    content += `---\n\n`;
    
    for (const chapter of chapters) {
      content += `## ${chapter.title}\n\n`;
      content += `${chapter.content || ''}\n\n`;
    }

    // Generate file based on format
    let fileBuffer: Buffer;
    let mimeType: string;
    let fileExtension: string;

    switch (format) {
      case 'html':
        fileBuffer = Buffer.from(generateHTML(content, project.title), 'utf-8');
        mimeType = 'text/html';
        fileExtension = 'html';
        break;
      
      case 'word':
        // For now, export as plain text with .txt extension
        // In production, use a library like docx to generate proper Word files
        fileBuffer = Buffer.from(content, 'utf-8');
        mimeType = 'text/plain';
        fileExtension = 'txt';
        break;
      
      case 'pdf':
      case 'epub':
        // These formats require specialized libraries
        // For now, export as HTML
        fileBuffer = Buffer.from(generateHTML(content, project.title), 'utf-8');
        mimeType = 'text/html';
        fileExtension = 'html';
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Upload to S3
    const fileKey = `exports/${userId}/${projectId}/${Date.now()}.${fileExtension}`;
    const { url } = await storagePut(fileKey, fileBuffer, mimeType);

    // Update export record
    await updateExportRecord(recordId, {
      fileUrl: url,
      fileKey,
      fileSize: fileBuffer.length,
      status: 'completed',
    });

    // Notify owner
    await notifyOwner({
      title: '作品导出完成',
      content: `项目"${project.title}"已成功导出为${format.toUpperCase()}格式`,
    });

    return {
      fileUrl: url,
      fileKey,
      fileSize: fileBuffer.length,
    };
  } catch (error: any) {
    // Update export record with error
    await updateExportRecord(recordId, {
      status: 'failed',
      errorMessage: error.message,
    });

    // Notify owner of failure
    await notifyOwner({
      title: '作品导出失败',
      content: `导出失败: ${error.message}`,
    });

    throw error;
  }
}

/**
 * Generate HTML from markdown content
 */
function generateHTML(content: string, title: string): string {
  // Simple markdown to HTML conversion
  // In production, use a proper markdown library like marked
  let html = content
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Songti SC', 'SimSun', serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 {
      font-size: 2.5em;
      text-align: center;
      margin-bottom: 0.5em;
      color: #000;
    }
    h2 {
      font-size: 1.8em;
      margin-top: 2em;
      margin-bottom: 0.5em;
      color: #222;
    }
    h3 {
      font-size: 1.4em;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      color: #444;
    }
    p {
      margin-bottom: 1em;
      text-indent: 2em;
    }
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 2em 0;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();
}
