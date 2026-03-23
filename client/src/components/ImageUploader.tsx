import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface ImageUploaderProps {
  onUpload: (file: File) => Promise<void>;
  uploadedImage?: string;
  onRemove?: () => void;
}

export function ImageUploader({ onUpload, uploadedImage, onRemove }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
        await handleFileUpload(file);
      }
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file) {
        await handleFileUpload(file);
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  if (uploadedImage) {
    return (
      <div className="relative">
        <div className="border-2 border-border rounded-xl overflow-hidden">
          <img
            src={uploadedImage}
            alt="Uploaded product"
            className="w-full h-auto max-h-96 object-contain bg-gray-50"
          />
        </div>
        {onRemove && (
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={onRemove}
          >
            <X className="w-4 h-4 mr-1" />
            删除
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">上传中...</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">上传产品图片</h3>
            <p className="text-sm text-muted-foreground mb-4">
              点击或拖拽图片到此区域上传
            </p>
            <p className="text-xs text-muted-foreground">
              支持 JPG、PNG 格式，建议尺寸 1000x1000 以上
            </p>
          </>
        )}
      </div>
    </div>
  );
}
