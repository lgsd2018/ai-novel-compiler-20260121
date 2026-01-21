import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Edit, 
  HelpCircle, 
  Search, 
  Settings, 
  User, 
  Minus, 
  Square, 
  X,
  UserCircle,
  FolderPlus,
  FolderX,
  History,
  FolderOpen
} from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RecentProject } from "@/hooks/useRecentProjects";

interface TopBarProps {
  projectTitle?: string;
  onSave?: () => void;
  user?: any;
  onNewFolder?: () => void;
  onCloseFolder?: () => void;
  recentProjects?: RecentProject[];
  onOpenRecent?: (id: number) => void;
}

export function TopBar({ 
  projectTitle, 
  onSave, 
  user,
  onNewFolder,
  onCloseFolder,
  recentProjects = [],
  onOpenRecent
}: TopBarProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N for New Folder
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        onNewFolder?.();
      }
      // Ctrl+W for Close Folder (Browser usually captures this, but we can try)
      if (e.ctrlKey && e.key === 'w') {
         e.preventDefault();
         setShowCloseConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewFolder]);

  return (
    <>
    <div className="h-12 border-b border-border bg-background flex items-center justify-between px-2 shrink-0 select-none">
      {/* Left: Menus */}
      <div className="flex items-center gap-2">
        <Menubar className="border-none shadow-none bg-transparent h-auto p-0">
          <MenubarMenu>
            <MenubarTrigger className="cursor-pointer">文件</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={onNewFolder}>
                <FolderPlus className="w-4 h-4 mr-2" />
                新建文件夹 <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>
                  <History className="w-4 h-4 mr-2" />
                  打开最近文件夹
                </MenubarSubTrigger>
                <MenubarSubContent>
                  {recentProjects.length === 0 ? (
                    <MenubarItem disabled>无历史记录</MenubarItem>
                  ) : (
                    recentProjects.map(project => (
                      <MenubarItem key={project.id} onClick={() => onOpenRecent?.(project.id)}>
                        {project.title}
                      </MenubarItem>
                    ))
                  )}
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={() => setShowCloseConfirm(true)}>
                <FolderX className="w-4 h-4 mr-2" />
                关闭文件夹 <MenubarShortcut>Ctrl+W</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={onSave}>
                保存 <MenubarShortcut>Ctrl+S</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>导入...</MenubarItem>
              <MenubarItem>导出...</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>退出</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="cursor-pointer">编辑</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>撤销 <MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem>
              <MenubarItem>重做 <MenubarShortcut>Ctrl+Y</MenubarShortcut></MenubarItem>
              <MenubarSeparator />
              <MenubarItem>剪切 <MenubarShortcut>Ctrl+X</MenubarShortcut></MenubarItem>
              <MenubarItem>复制 <MenubarShortcut>Ctrl+C</MenubarShortcut></MenubarItem>
              <MenubarItem>粘贴 <MenubarShortcut>Ctrl+V</MenubarShortcut></MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="cursor-pointer">帮助</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>文档</MenubarItem>
              <MenubarItem>快捷键说明</MenubarItem>
              <MenubarSeparator />
              <MenubarItem>关于</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      {/* Center: Search & Path */}
      <div className="flex-1 max-w-xl mx-4 relative flex items-center justify-center">
        {projectTitle && (
            <div className="text-sm text-muted-foreground mr-4 hidden md:block whitespace-nowrap">
                当前文件夹: <span className="text-foreground font-medium">{projectTitle}</span>
            </div>
        )}
        <div className="relative w-full max-w-[200px]">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input 
               placeholder="搜索..."
               className="h-8 pl-8 bg-muted/50 border-transparent focus:bg-background focus:border-input" 
             />
        </div>
      </div>

      {/* Right: Actions & Window Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
        
        <Avatar className="h-7 w-7 cursor-pointer">
          <AvatarImage src={user?.avatarUrl} />
          <AvatarFallback><UserCircle className="w-5 h-5" /></AvatarFallback>
        </Avatar>

        <div className="h-4 w-px bg-border/50 mx-1" />
      </div>
    </div>

    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认关闭文件夹？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作将关闭当前打开的文件夹（项目）并返回主控台。未保存的更改可能会丢失。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            setShowCloseConfirm(false);
            onCloseFolder?.();
          }}>
            确认关闭
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
