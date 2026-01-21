import { z } from 'zod';
import { publicProcedure, router } from '../../_core/trpc';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

function isSafePath(targetPath: string) {
  try {
      const normalizedTarget = path.normalize(targetPath);
      const absoluteTarget = path.isAbsolute(normalizedTarget) 
        ? normalizedTarget 
        : path.resolve(PROJECT_ROOT, normalizedTarget);
      return absoluteTarget.startsWith(PROJECT_ROOT) && !absoluteTarget.includes('node_modules') && !absoluteTarget.includes('.git');
  } catch (e) {
      return false;
  }
}

export const fileSystemRouter = router({
  readFile: publicProcedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new Error('User not authenticated');

      if (!isSafePath(input.path)) {
        throw new Error(`Access denied: ${input.path}`);
      }
      
      try {
        const filePath = path.isAbsolute(input.path) ? input.path : path.resolve(PROJECT_ROOT, input.path);
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
      } catch (error: any) {
         return { content: null, error: error.message };
      }
    }),

  writeFile: publicProcedure
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (!isSafePath(input.path)) {
        throw new Error(`Access denied: ${input.path}`);
      }

      try {
        const filePath = path.isAbsolute(input.path) ? input.path : path.resolve(PROJECT_ROOT, input.path);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        await fs.writeFile(filePath, input.content, 'utf-8');
        return { success: true };
      } catch (error: any) {
        throw new Error(`Failed to write file: ${error.message}`);
      }
    }),
});
