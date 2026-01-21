import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Heading1,
    Heading2,
    Heading3,
    Link,
    Highlighter,
    Minus,
    RemoveFormatting,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

interface EditorToolbarProps {
    editor: Editor | null;
}

const TEXT_COLORS = [
    { name: "默认", color: "inherit" },
    { name: "红色", color: "#ef4444" },
    { name: "橙色", color: "#f97316" },
    { name: "黄色", color: "#eab308" },
    { name: "绿色", color: "#22c55e" },
    { name: "蓝色", color: "#3b82f6" },
    { name: "紫色", color: "#a855f7" },
    { name: "粉色", color: "#ec4899" },
    { name: "灰色", color: "#6b7280" },
];

const HIGHLIGHT_COLORS = [
    { name: "无", color: "" },
    { name: "黄色", color: "#fef08a" },
    { name: "绿色", color: "#bbf7d0" },
    { name: "蓝色", color: "#bfdbfe" },
    { name: "紫色", color: "#e9d5ff" },
    { name: "粉色", color: "#fbcfe8" },
    { name: "橙色", color: "#fed7aa" },
];

export function EditorToolbar({ editor }: EditorToolbarProps) {
    const [linkUrl, setLinkUrl] = useState("");
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);

    if (!editor) {
        return null;
    }

    const setLink = () => {
        if (linkUrl) {
            editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: linkUrl })
                .run();
        } else {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
        }
        setIsLinkPopoverOpen(false);
        setLinkUrl("");
    };

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
            {/* Undo/Redo */}
            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="撤销"
                className="hover:bg-accent hover:text-accent-foreground transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
            >
                <Undo className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="重做"
                className="hover:bg-accent hover:text-accent-foreground transition-colors data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
            >
                <Redo className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Headings */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                        <Heading1 className="h-4 w-4 mr-1" />
                        <span className="text-xs">标题</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem
                        onClick={() => editor.chain().focus().setParagraph().run()}
                    >
                        <span className="text-sm">正文</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() =>
                            editor.chain().focus().toggleHeading({ level: 1 }).run()
                        }
                    >
                        <span className="text-2xl font-bold">标题 1</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() =>
                            editor.chain().focus().toggleHeading({ level: 2 }).run()
                        }
                    >
                        <span className="text-xl font-bold">标题 2</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() =>
                            editor.chain().focus().toggleHeading({ level: 3 }).run()
                        }
                    >
                        <span className="text-lg font-bold">标题 3</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Text Formatting */}
            <Toggle
                size="sm"
                pressed={editor.isActive("bold")}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                title="加粗 (Ctrl+B)"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive("italic")}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                title="斜体 (Ctrl+I)"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive("underline")}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                title="下划线 (Ctrl+U)"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <Underline className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive("strike")}
                onPressedChange={() => editor.chain().focus().toggleStrike().run()}
                title="删除线"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <Strikethrough className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Text Color */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                        <span
                            className="h-4 w-4 rounded border flex items-center justify-center text-xs font-bold"
                            style={{
                                color: editor.getAttributes("textStyle").color || "inherit",
                            }}
                        >
                            A
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {TEXT_COLORS.map((c) => (
                        <DropdownMenuItem
                            key={c.color}
                            onClick={() => {
                                if (c.color === "inherit") {
                                    editor.chain().focus().unsetColor().run();
                                } else {
                                    editor.chain().focus().setColor(c.color).run();
                                }
                            }}
                        >
                            <span
                                className="w-4 h-4 rounded mr-2"
                                style={{ backgroundColor: c.color === "inherit" ? "#000" : c.color }}
                            />
                            {c.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Highlight */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2" title="高亮">
                        <Highlighter className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {HIGHLIGHT_COLORS.map((c) => (
                        <DropdownMenuItem
                            key={c.color || "none"}
                            onClick={() => {
                                if (c.color === "") {
                                    editor.chain().focus().unsetHighlight().run();
                                } else {
                                    editor.chain().focus().toggleHighlight({ color: c.color }).run();
                                }
                            }}
                        >
                            <span
                                className="w-4 h-4 rounded mr-2 border"
                                style={{ backgroundColor: c.color || "transparent" }}
                            />
                            {c.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Text Alignment */}
            <Toggle
                size="sm"
                pressed={editor.isActive({ textAlign: "left" })}
                onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}
                title="左对齐"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <AlignLeft className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive({ textAlign: "center" })}
                onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}
                title="居中"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <AlignCenter className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive({ textAlign: "right" })}
                onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}
                title="右对齐"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <AlignRight className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive({ textAlign: "justify" })}
                onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}
                title="两端对齐"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <AlignJustify className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Lists */}
            <Toggle
                size="sm"
                pressed={editor.isActive("bulletList")}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                title="无序列表"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <List className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive("orderedList")}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                title="有序列表"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <ListOrdered className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive("blockquote")}
                onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                title="引用"
                className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
            >
                <Quote className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="mx-1 h-6" />

            {/* Link */}
            <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                <PopoverTrigger asChild>
                    <Toggle
                        size="sm"
                        pressed={editor.isActive("link")}
                        title="插入链接"
                        className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary transition-colors"
                    >
                        <Link className="h-4 w-4" />
                    </Toggle>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">链接地址</label>
                        <Input
                            placeholder="https://example.com"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setLink();
                                }
                            }}
                        />
                        <div className="flex gap-2 justify-end">
                            {editor.isActive("link") && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        editor.chain().focus().unsetLink().run();
                                        setIsLinkPopoverOpen(false);
                                    }}
                                >
                                    移除链接
                                </Button>
                            )}
                            <Button size="sm" onClick={setLink}>
                                确定
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Horizontal Rule */}
            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
                title="分隔线"
                className="hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <Minus className="h-4 w-4" />
            </Toggle>

            {/* Clear Formatting */}
            <Toggle
                size="sm"
                pressed={false}
                onPressedChange={() =>
                    editor.chain().focus().clearNodes().unsetAllMarks().run()
                }
                title="清除格式"
                className="hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <RemoveFormatting className="h-4 w-4" />
            </Toggle>
        </div>
    );
}
