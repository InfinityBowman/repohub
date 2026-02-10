import { ipcMain, BrowserWindow } from 'electron';
import type { ScaffoldService } from '../services/ScaffoldService';
import type { ScaffoldRecipe } from '../types/scaffold.types';

export function registerScaffoldHandlers(scaffoldService: ScaffoldService): void {
  // Template handlers
  ipcMain.handle('scaffold:get-templates', async () => {
    return scaffoldService.getTemplates();
  });

  ipcMain.handle(
    'scaffold:create-from-template',
    async (_event, templateName: string, projectName: string) => {
      return scaffoldService.createFromTemplate(templateName, projectName);
    },
  );

  // Recipe handlers
  ipcMain.handle('scaffold:get-recipes', async () => {
    return scaffoldService.getRecipes();
  });

  ipcMain.handle('scaffold:add-recipe', async (_event, recipe: ScaffoldRecipe) => {
    scaffoldService.addRecipe(recipe);
  });

  ipcMain.handle('scaffold:remove-recipe', async (_event, id: string) => {
    scaffoldService.removeRecipe(id);
  });

  ipcMain.handle('scaffold:run', async (_event, recipeId: string, projectName: string) => {
    return scaffoldService.run(recipeId, projectName);
  });

  ipcMain.handle('scaffold:write', async (_event, data: string) => {
    scaffoldService.write(data);
  });

  ipcMain.handle('scaffold:resize', async (_event, cols: number, rows: number) => {
    scaffoldService.resize(cols, rows);
  });

  ipcMain.handle('scaffold:cancel', async () => {
    scaffoldService.cancel();
  });

  // Forward events to renderer
  scaffoldService.on('output', data => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('scaffold:output', data);
    }
  });

  scaffoldService.on('done', data => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('scaffold:done', data);
    }
  });
}
