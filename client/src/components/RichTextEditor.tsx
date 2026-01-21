import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { EditorToolbar } from "./EditorToolbar";
import { useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

export interface RichTextEditorRef {
    insertContent: (text: string) => void;
}

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    editable?: boolean;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
    content,
    onChange,
    placeholder = "开始写作...",
    className = "",
    editable = true,
}, ref) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: "is-editor-empty",
            }),
            Underline,
            TextAlign.configure({
                types: ["heading", "paragraph"],
            }),
            Highlight.configure({
                multicolor: true,
            }),
            TextStyle,
            Color,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-primary underline cursor-pointer",
                },
            }),
        ],
        content: content || "",
        editable,
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[calc(100vh-400px)] font-serif",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        insertContent: (text: string) => {
            if (editor) {
                // If text looks like code, insert as code block
                // For now, we just insert as content. TipTap handles HTML or text.
                // To support "Undo", TipTap handles history automatically.
                editor.chain().focus().insertContent(text).run();
            }
        }
    }));

    // Sync content from parent when it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            // Check if this is plain text (no HTML tags) and convert to HTML
            const isPlainText = !content.includes("<") && !content.includes(">");
            if (isPlainText && content) {
                // Convert plain text to HTML paragraphs
                const htmlContent = content
                    .split("\n\n")
                    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
                    .join("");
                editor.commands.setContent(htmlContent, { emitUpdate: false });
            } else {
                editor.commands.setContent(content, { emitUpdate: false });
            }
        }
    }, [editor, content]);

    // Update editable state
    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editor, editable]);

    // Method to insert content at cursor
    const insertContent = useCallback(
        (text: string) => {
            if (editor) {
                editor.chain().focus().insertContent(text).run();
            }
        },
        [editor]
    );

    // Expose insert method via ref or callback if needed
    useEffect(() => {
        // Make insertContent available on the window for external access
        (window as any).__richTextEditorInsert = insertContent;
        return () => {
            delete (window as any).__richTextEditorInsert;
        };
    }, [insertContent]);

    return (
        <div className={`flex flex-col h-full bg-transparent ${className}`}>
            <EditorToolbar editor={editor} />
            <div className="flex-1 overflow-auto p-8 flex justify-center scrollbar-hide">
                <div className="w-full max-w-4xl bg-card text-card-foreground min-h-[calc(100vh-200px)] shadow-sm border border-border/50 rounded-xl px-12 py-12 transition-all duration-300 hover:shadow-md">
                    <EditorContent editor={editor} className="h-full" />
                </div>
            </div>
        </div>
    );
});

// Helper function to convert plain text to HTML
export function plainTextToHtml(text: string): string {
    if (!text) return "";
    return text
        .split("\n\n")
        .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

// Helper function to convert HTML to plain text
export function htmlToPlainText(html: string): string {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
}
