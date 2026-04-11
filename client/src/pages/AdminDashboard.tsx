import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { Car, DollarSign, Plus, Trash2, Edit, LogOut, ArrowLeft, Upload, Image, Video, Images, Star, X, ChevronUp, ChevronDown, ArrowUpDown, Loader2, BarChart3, TrendingUp, Eye, Calendar, Newspaper, ExternalLink, LineChart } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { compressImage, fileToBase64 } from "@/lib/imageCompressor";
import { checkVideoCodec, formatCodecErrorMessage } from "@/lib/videoCodecChecker";

// ファイルアップロードコンポーネント（圧縮・プログレス対応）
function FileUploader({ 
  onUpload, 
  accept = "image/*,video/*",
  folder,
  label = "ファイルを選択",
  currentUrl
}: { 
  onUpload: (url: string) => void;
  accept?: string;
  folder: "vehicles" | "purchase-records" | "slideshow";
  label?: string;
  currentUrl?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);
  
  const uploadMutation = trpc.upload.file.useMutation({
    onSuccess: (data) => {
      onUpload(data.url);
      toast.success("アップロード完了");
      setProgress(100);
      setStatusText("");
    },
    onError: (error) => {
      toast.error(`アップロードエラー: ${error.message}`);
      setStatusText("");
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("ファイルサイズは100MB以下にしてください");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // プレビュー表示
      const previewReader = new FileReader();
      previewReader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      previewReader.readAsDataURL(file);

      // 画像の場合は圧縮
      setStatusText("処理中...");
      setProgress(10);
      
      let processedFile = file;
      if (file.type.startsWith('image/') && !file.type.includes('heic') && !file.type.includes('heif')) {
        setStatusText("画像を最適化中...");
        processedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          maxSizeMB: 5,
        });
        setProgress(40);
      }

      // Base64に変換
      setStatusText("アップロード準備中...");
      setProgress(50);
      const base64 = await fileToBase64(processedFile);
      
      // アップロード
      setStatusText("アップロード中...");
      setProgress(70);
      await uploadMutation.mutateAsync({
        fileName: file.name,
        contentType: processedFile.type,
        base64Data: base64,
        folder,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("アップロードに失敗しました");
    } finally {
      setUploading(false);
      setProgress(0);
      setStatusText("");
    }
  };

  const isVideo = preview?.includes('video') || preview?.endsWith('.mp4') || preview?.endsWith('.mov');

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      {preview && (
        <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden">
          {isVideo ? (
            <video src={preview} className="w-full h-full object-cover" controls />
          ) : (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          )}
        </div>
      )}
      
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 text-center">{statusText}</p>
        </div>
      )}
      
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {statusText || "処理中..."}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}

// 複数ファイルアップロードコンポーネント（圧縮・プログレス対応）
function MultiFileUploader({
  onUpload,
  folder,
}: {
  onUpload: (url: string, type: "image" | "video", index: number, total: number, bunnyVideoId?: string) => void;
  folder: "vehicles" | "purchase-records" | "slideshow";
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 署名付きURL取得用
  const getUploadUrlMutation = trpc.upload.getUploadUrl.useMutation();
  // Bunny Streamアップロード用
  const bunnyUploadMutation = trpc.bunnyStream.uploadVideo.useMutation();

  // XHRで動画1本アップロード（リトライ付き）
  const uploadVideoWithRetry = async (
    file: File,
    maxRetries: number = 3,
  ): Promise<{ videoId: string; videoUrl: string; thumbUrl: string; converted: boolean }> => {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const label = attempt > 1 ? `${file.name} リトライ${attempt}/${maxRetries}` : file.name;
        console.log(`[upload] attempt ${attempt}: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
        setStatusText(`${label} iOS変換待ち...`);

        const result = await new Promise<{ videoId: string; videoUrl: string; thumbUrl: string; converted: boolean }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/upload-video?title=${encodeURIComponent(file.name)}`);
          xhr.timeout = 600000; // 10分
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setStatusText(`${label} 送信中 ${pct}% (${(e.loaded/1024/1024).toFixed(1)}/${(e.total/1024/1024).toFixed(1)}MB)`);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('レスポンス解析失敗')); }
            } else {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('ネットワークエラー'));
          xhr.ontimeout = () => reject(new Error('タイムアウト'));
          xhr.send(formData);
        });
        return result;
      } catch (e: any) {
        lastError = e;
        console.warn(`[upload] attempt ${attempt} failed: ${e.message}`);
        if (attempt < maxRetries) {
          setStatusText(`${file.name} 失敗、${attempt + 1}回目を試行中...`);
          await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s backoff
        }
      }
    }
    throw lastError || new Error('アップロード失敗');
  };

  // 単一ファイルをアップロードする関数
  const uploadSingleFile = async (
    file: File,
    index: number,
    total: number,
    onProgress: (completed: number) => void
  ): Promise<{ url: string; type: "image" | "video"; bunnyVideoId?: string } | null> => {
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 500 * 1024 * 1024 : 100 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error(`${file.name}: サイズオーバー`);
      return null;
    }

    try {
      // 動画の場合は /api/upload-video で直接変換+保存（Bunny Stream不使用）
      if (isVideo) {
        // 形式チェック（MP4以外は拒否）
        const codecCheck = checkVideoCodec(file);
        if (!codecCheck.isValid) {
          toast.error(formatCodecErrorMessage(codecCheck), {
            duration: 10000,
            description: 'MP4形式でアップロードしてください',
          });
          return null;
        }

        console.log(`[upload] starting: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB) type=${file.type}`);
        const result = await uploadVideoWithRetry(file);
        console.log(`[upload] ${result.converted ? 'HLG→bt709 tonemap' : 'SDR copy'}: ${result.videoId}`);

        onProgress(1);
        return {
          url: result.videoUrl,
          type: 'video',
          bunnyVideoId: result.videoId,
        };
      }
      
      // 画像の場合は圧縮してS3にアップロード
      let processedFile = file;
      if (file.type.startsWith('image/') && !file.type.includes('heic') && !file.type.includes('heif')) {
        processedFile = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          maxSizeMB: 5,
        });
      }

      // 署名付きURLを取得
      const imgUploadInfo = await getUploadUrlMutation.mutateAsync({
        fileName: file.name,
        contentType: processedFile.type,
        folder,
      });

      // 直接アップロード
      const formData = new FormData();
      formData.append('file', processedFile);

      const imgHeaders: Record<string, string> = {};
      if (imgUploadInfo.apiKey) {
        imgHeaders['Authorization'] = `Bearer ${imgUploadInfo.apiKey}`;
      }

      const response = await fetch(imgUploadInfo.uploadUrl, {
        method: 'POST',
        headers: imgHeaders,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`アップロード失敗: ${response.status}`);
      }

      const result = await response.json();
      onProgress(1);
      
      return {
        url: result.url,
        type: 'image',
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`${file.name} のアップロードに失敗`);
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // ファイルリストを即座にコピー（input resetで消えるため）
    const fileArray = Array.from(files);
    // input即リセット — iOS Safari で2回目以降のonChangeが発火しない問題を防ぐ
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';

    setUploading(true);
    setTotalFiles(fileArray.length);
    setCompletedCount(0);
    setProgress(0);

    let completed = 0;
    const updateProgress = () => {
      completed++;
      setCompletedCount(completed);
      setProgress((completed / fileArray.length) * 100);
    };

    // 動画と画像を分離
    const videos = fileArray.filter(f => f.type.startsWith('video/'));
    const images = fileArray.filter(f => !f.type.startsWith('video/'));

    const results: ({ url: string; type: "image" | "video"; bunnyVideoId?: string } | null)[] = [];

    // 動画は1本ずつ順次アップロード（iOS HEVC変換の負荷分散）
    if (videos.length > 0) {
      setStatusText(`動画 0/${videos.length} 完了`);
      for (let i = 0; i < videos.length; i++) {
        const r = await uploadSingleFile(videos[i], i, videos.length, updateProgress);
        results.push(r);
        if (r) {
          onUpload(r.url, r.type, i, fileArray.length, r.bunnyVideoId);
          setStatusText(`動画 ${i + 1}/${videos.length} 完了`);
        }
      }
    }

    // 画像は並列アップロード
    if (images.length > 0) {
      setStatusText(`画像 ${images.length}件 アップロード中...`);
      const imgResults = await Promise.all(
        images.map((file, i) => uploadSingleFile(file, i, images.length, updateProgress))
      );
      imgResults.forEach((r, i) => {
        results.push(r);
        if (r) onUpload(r.url, r.type, videos.length + i, fileArray.length);
      });
    }

    const successCount = results.filter(r => r !== null).length;
    if (successCount > 0) {
      toast.success(`${successCount}件のアップロードが完了しました`);
    }

    setUploading(false);
    setProgress(0);
    setStatusText("");
    setCompletedCount(0);
    setTotalFiles(0);
  };

  return (
    <div className="space-y-2">
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500 text-center">
            {completedCount}/{totalFiles} - {statusText}
          </p>
        </div>
      )}

      {uploading ? (
        <Button variant="outline" disabled className="w-full">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          アップロード中 ({completedCount}/{totalFiles})
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => videoInputRef.current?.click()}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            動画を追加
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            画像を追加
          </Button>
        </div>
      )}
    </div>
  );
}

// 車両メディア管理コンポーネント（並び替え機能付き）
function VehicleMediaManager({ 
  vehicleId,
  onClose
}: { 
  vehicleId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: mediaList, isLoading } = trpc.vehicleMedia.list.useQuery({ vehicleId });
  
  const createMediaMutation = trpc.vehicleMedia.create.useMutation({
    onSuccess: () => {
      utils.vehicleMedia.list.invalidate({ vehicleId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMediaMutation = trpc.vehicleMedia.delete.useMutation({
    onSuccess: () => {
      toast.success("メディアを削除しました");
      utils.vehicleMedia.list.invalidate({ vehicleId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const setMainMutation = trpc.vehicleMedia.setMain.useMutation({
    onSuccess: () => {
      toast.success("メインメディアを設定しました");
      utils.vehicleMedia.list.invalidate({ vehicleId });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const reorderMutation = trpc.vehicleMedia.reorder.useMutation({
    onError: () => {
      toast.error("順序更新に失敗しました");
      utils.vehicleMedia.list.invalidate({ vehicleId });
    },
  });

  // debounce付きサーバー同期（連打対応）
  const pendingReorderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingItemsRef = useRef<{id: number; displayOrder: number}[] | null>(null);



  // 画像最適化mutation
  const optimizeImageMutation = trpc.imageOptimize.optimize.useMutation({
    onSuccess: () => {
      utils.vehicleMedia.list.invalidate({ vehicleId });
    },
    onError: (error) => {
      console.error('Image optimization failed:', error);
      // 最適化失敗でも元画像は使えるのでエラーは出さない
    },
  });

  const handleUpload = (url: string, type: "image" | "video", index: number, total: number, bunnyVideoId?: string) => {
    // 現在の最大値を取得
    const maxOrder = mediaList?.reduce((max, m) => Math.max(max, m.displayOrder || 0), 0) || 0;
    // 選択順序（index）をそのまま使用（最初に選択したものが最初に表示される）
    const newOrder = maxOrder + 1 + index;
    
    createMediaMutation.mutate({
      vehicleId,
      type,
      url,
      displayOrder: newOrder,
      isMain: !mediaList || mediaList.length === 0,
      bunnyVideoId: bunnyVideoId || null,
      // 動画の場合はbunnyStatusを設定
      bunnyStatus: type === 'video' && bunnyVideoId ? 'pending' : null,
    }, {
      onSuccess: (_, variables) => {
        // 画像の場合は自動最適化をバックグラウンドで実行
        if (type === 'image') {
          // 作成されたメディアのIDを取得するためにリストを再取得
          utils.vehicleMedia.list.invalidate({ vehicleId }).then(() => {
            // 最新のメディアリストから該当のメディアを見つけて最適化
            const latestMedia = utils.vehicleMedia.list.getData({ vehicleId });
            const newMedia = latestMedia?.find(m => m.url === url && m.type === 'image');
            if (newMedia) {
              const filename = url.split('/').pop() || 'image.jpg';
              optimizeImageMutation.mutate({
                mediaId: newMedia.id,
                imageUrl: url,
                vehicleId,
                filename,
              });
            }
          });
        }
      },
    });
  };

  const flushReorder = (list: typeof mediaList) => {
    if (!list) return;
    const items = list.map((m, i) => ({ id: m.id, displayOrder: i }));
    pendingItemsRef.current = items;
    if (pendingReorderRef.current) clearTimeout(pendingReorderRef.current);
    pendingReorderRef.current = setTimeout(() => {
      if (pendingItemsRef.current) {
        reorderMutation.mutate({ items: pendingItemsRef.current });
        pendingItemsRef.current = null;
      }
    }, 500);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const current = utils.vehicleMedia.list.getData({ vehicleId });
    if (!current) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= current.length) return;
    const swapped = [...current];
    [swapped[index], swapped[newIndex]] = [swapped[newIndex], swapped[index]];
    const withOrder = swapped.map((m, i) => ({ ...m, displayOrder: i }));
    utils.vehicleMedia.list.setData({ vehicleId }, withOrder);
    flushReorder(withOrder);
  };

  const moveToTop = (index: number) => {
    const current = utils.vehicleMedia.list.getData({ vehicleId });
    if (!current || index === 0) return;
    const item = current[index];
    const rest = current.filter((_, i) => i !== index);
    const reordered = [item, ...rest].map((m, i) => ({ ...m, displayOrder: i }));
    utils.vehicleMedia.list.setData({ vehicleId }, reordered);
    flushReorder(reordered);
  };

  const moveToBottom = (index: number) => {
    const current = utils.vehicleMedia.list.getData({ vehicleId });
    if (!current || index === current.length - 1) return;
    const item = current[index];
    const rest = current.filter((_, i) => i !== index);
    const reordered = [...rest, item].map((m, i) => ({ ...m, displayOrder: i }));
    utils.vehicleMedia.list.setData({ vehicleId }, reordered);
    flushReorder(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">メディア管理</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <p className="text-sm text-gray-500">
        複数の画像・動画をアップロードできます。上下ボタンで順番を変更、星マークでメインメディアを設定できます。
        <br />
        <span className="text-xs text-blue-600">※画像は自動的に最適化されます（最大1920px、5MB以下に圧縮）</span>
        <br />
        <span className="text-xs text-green-600">※動画は500MBまでアップロード可能（複数の動画もOK）</span>
      </p>

      <MultiFileUploader
        folder="vehicles"
        onUpload={handleUpload}
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : mediaList && mediaList.length > 0 ? (
        <div className="space-y-2">
          {mediaList.map((media, index) => (
            <div key={media.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              {/* 並び替えボタン */}
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-8 text-[10px] font-bold"
                  onClick={() => moveToTop(index)}
                  disabled={index === 0}
                >
                  ⤒
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-8"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-8"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === mediaList.length - 1}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-8 text-[10px] font-bold"
                  onClick={() => moveToBottom(index)}
                  disabled={index === mediaList.length - 1}
                >
                  ⤓
                </Button>
              </div>
              
              {/* サムネイル */}
              <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                {media.type === 'video' ? (
                  <video src={media.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              
              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {media.type === 'video' ? (
                    <Video className="w-4 h-4 text-gray-500" />
                  ) : (
                    <Image className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-600 truncate">
                    {media.type === 'video' ? '動画' : '画像'} #{index + 1}
                  </span>
                  {media.isMain && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">メイン</span>
                  )}
                </div>
              </div>
              
              {/* アクション */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", media.isMain && "text-yellow-500")}
                  onClick={() => setMainMutation.mutate({ vehicleId, mediaId: media.id })}
                  disabled={media.isMain || setMainMutation.isPending}
                  title="メインに設定"
                >
                  <Star className={cn("w-4 h-4", media.isMain && "fill-yellow-500")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => deleteMediaMutation.mutate({ id: media.id })}
                  disabled={deleteMediaMutation.isPending}
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Images className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>メディアがありません</p>
          <p className="text-sm">上のボタンから画像・動画を追加してください</p>
        </div>
      )}
    </div>
  );
}

// 車両編集ダイアログ
function VehicleEditDialog({ 
  vehicle, 
  open, 
  onOpenChange,
  onSuccess
}: { 
  vehicle: { id: number; title: string; price: number | null; priceDisplay: string | null; description: string | null; videoUrl: string | null; imageUrl: string | null; status: "在庫あり" | "商談中" | "売約済み"; isPublished: boolean | null; isConsignment: boolean | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [editData, setEditData] = useState({
    title: vehicle.title,
    priceDisplay: vehicle.priceDisplay || "",
    description: vehicle.description || "",
    videoUrl: vehicle.videoUrl || "",
    imageUrl: vehicle.imageUrl || "",
    status: vehicle.status,
    isPublished: vehicle.isPublished ?? true,
    isConsignment: vehicle.isConsignment ?? false,
  });
  const [showMediaManager, setShowMediaManager] = useState(false);

  useEffect(() => {
    setEditData({
      title: vehicle.title,
      priceDisplay: vehicle.priceDisplay || "",
      description: vehicle.description || "",
      videoUrl: vehicle.videoUrl || "",
      imageUrl: vehicle.imageUrl || "",
      status: vehicle.status,
      isPublished: vehicle.isPublished ?? true,
      isConsignment: vehicle.isConsignment ?? false,
    });
    setShowMediaManager(false);
  }, [vehicle]);

  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: () => {
      toast.success("車両情報を更新しました");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  if (showMediaManager) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <VehicleMediaManager vehicleId={vehicle.id} onClose={() => setShowMediaManager(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>車両を編集</DialogTitle>
          <DialogDescription>車両情報を編集します</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="editTitle">車両名 *</Label>
            <Input
              id="editTitle"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              placeholder="例: Toyota Crown Athlete 2.5"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editPriceDisplay">価格表示 *</Label>
            <Input
              id="editPriceDisplay"
              value={editData.priceDisplay}
              onChange={(e) => setEditData({ ...editData, priceDisplay: e.target.value })}
              placeholder="例: 598,000- または お問い合わせください"
            />
            <p className="text-xs text-gray-500">そのまま表示されます（例: 598,000- 、ASK、お問い合わせください）</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editDescription">説明</Label>
            <Textarea
              id="editDescription"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="車両の詳細説明"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>メディア（画像・動画）</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMediaManager(true)}
              className="w-full"
            >
              <Images className="w-4 h-4 mr-2" />
              メディアを管理
            </Button>
            <p className="text-xs text-gray-500">複数の画像・動画をアップロード・管理できます</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editStatus">ステータス</Label>
            <Select
              value={editData.status}
              onValueChange={(value: "在庫あり" | "商談中" | "売約済み") => setEditData({ ...editData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="在庫あり">在庫あり</SelectItem>
                <SelectItem value="商談中">商談中</SelectItem>
                <SelectItem value="売約済み">売約済み</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="editPublished"
              checked={editData.isPublished}
              onCheckedChange={(checked) => setEditData({ ...editData, isPublished: checked })}
            />
            <Label htmlFor="editPublished">公開する</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="editConsignment"
              checked={editData.isConsignment}
              onCheckedChange={(checked) => setEditData({ ...editData, isConsignment: checked })}
            />
            <Label htmlFor="editConsignment">委託車両</Label>
          </div>
          {editData.isConsignment && (
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              ※委託車両は「委託在庫一覧」タブに表示されます
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => updateMutation.mutate({ id: vehicle.id, ...editData })}
            disabled={!editData.title || !editData.priceDisplay || updateMutation.isPending}
            className="bg-black hover:bg-gray-800"
          >
            {updateMutation.isPending ? "更新中..." : "更新"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 買取実績編集ダイアログ
function RecordEditDialog({ 
  record, 
  open, 
  onOpenChange,
  onSuccess
}: { 
  record: { id: number; vehicleName: string; purchasePrice: number; priceDisplay: string | null; comment: string | null; imageUrl: string | null; isPublished: boolean | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [editData, setEditData] = useState({
    vehicleName: record.vehicleName,
    purchasePrice: record.purchasePrice,
    priceDisplay: record.priceDisplay || "",
    comment: record.comment || "",
    imageUrl: record.imageUrl || "",
    isPublished: record.isPublished ?? true,
  });

  useEffect(() => {
    setEditData({
      vehicleName: record.vehicleName,
      purchasePrice: record.purchasePrice,
      priceDisplay: record.priceDisplay || "",
      comment: record.comment || "",
      imageUrl: record.imageUrl || "",
      isPublished: record.isPublished ?? true,
    });
  }, [record]);

  const updateMutation = trpc.purchaseRecords.update.useMutation({
    onSuccess: () => {
      toast.success("買取実績を更新しました");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>買取実績を編集</DialogTitle>
          <DialogDescription>買取実績情報を編集します</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="editVehicleName">車両名 *</Label>
            <Input
              id="editVehicleName"
              value={editData.vehicleName}
              onChange={(e) => setEditData({ ...editData, vehicleName: e.target.value })}
              placeholder="例: トヨタ ヴィッツ"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editPurchasePrice">買取価格（円） *</Label>
            <Input
              id="editPurchasePrice"
              type="number"
              value={editData.purchasePrice}
              onChange={(e) => setEditData({ ...editData, purchasePrice: parseInt(e.target.value) || 0 })}
              placeholder="例: 350000"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editPriceDisplay">価格表示（任意）</Label>
            <Input
              id="editPriceDisplay"
              value={editData.priceDisplay}
              onChange={(e) => setEditData({ ...editData, priceDisplay: e.target.value })}
              placeholder="例: 35万円"
            />
            <p className="text-xs text-gray-500">空欄の場合は自動で「○万円」形式で表示されます</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editComment">コメント</Label>
            <Textarea
              id="editComment"
              value={editData.comment}
              onChange={(e) => setEditData({ ...editData, comment: e.target.value })}
              placeholder="例: 他社より5万円高く買取！"
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>画像をアップロード</Label>
            <FileUploader
              folder="purchase-records"
              accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
              label="画像を選択"
              currentUrl={editData.imageUrl}
              onUpload={(url) => setEditData({ ...editData, imageUrl: url })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="editRecordPublished"
              checked={editData.isPublished}
              onCheckedChange={(checked) => setEditData({ ...editData, isPublished: checked })}
            />
            <Label htmlFor="editRecordPublished">公開する</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => updateMutation.mutate({ id: record.id, ...editData })}
            disabled={!editData.vehicleName || !editData.purchasePrice || updateMutation.isPending}
            className="bg-black hover:bg-gray-800"
          >
            {updateMutation.isPending ? "更新中..." : "更新"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// スライドショーメディア編集ダイアログ
function MediaEditDialog({ 
  media, 
  open, 
  onOpenChange,
  onSuccess
}: { 
  media: { id: number; type: "image" | "video"; url: string; title: string | null; displayOrder: number | null; isPublished: boolean | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [editData, setEditData] = useState({
    type: media.type,
    url: media.url,
    title: media.title || "",
    displayOrder: media.displayOrder || 0,
    isPublished: media.isPublished ?? true,
  });

  useEffect(() => {
    setEditData({
      type: media.type,
      url: media.url,
      title: media.title || "",
      displayOrder: media.displayOrder || 0,
      isPublished: media.isPublished ?? true,
    });
  }, [media]);

  const updateMutation = trpc.slideshowMedia.update.useMutation({
    onSuccess: () => {
      toast.success("スライドショーメディアを更新しました");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>スライドショーメディアを編集</DialogTitle>
          <DialogDescription>スライドショーメディア情報を編集します</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>メディアタイプ</Label>
            <Select value={editData.type} onValueChange={(value: "image" | "video") => setEditData({ ...editData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">画像</SelectItem>
                <SelectItem value="video">動画</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>メディアをアップロード</Label>
            <FileUploader
              folder="slideshow"
              accept={editData.type === "video" ? "video/*,.mp4,.mov,.avi,.webm" : "image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"}
              label={editData.type === "video" ? "動画を選択" : "画像を選択"}
              currentUrl={editData.url}
              onUpload={(url) => setEditData({ ...editData, url })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editMediaTitle">タイトル（管理用）</Label>
            <Input
              id="editMediaTitle"
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              placeholder="例: ガレージ外観"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="editMediaPublished"
              checked={editData.isPublished}
              onCheckedChange={(checked) => setEditData({ ...editData, isPublished: checked })}
            />
            <Label htmlFor="editMediaPublished">公開する</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => updateMutation.mutate({ id: media.id, ...editData })}
            disabled={!editData.url || updateMutation.isPending}
            className="bg-black hover:bg-gray-800"
          >
            {updateMutation.isPending ? "更新中..." : "更新"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ビジネス指標パネルコンポーネント
function BusinessMetricsPanel() {
  const utils = trpc.useUtils();
  const { data: metrics, isLoading } = trpc.businessMetrics.list.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [editMetric, setEditMetric] = useState<{
    id?: number;
    year: number;
    totalTransactionAmount: number;
    assessmentCount: number;
    contractCount: number;
    // 本年のみ使用するフィールド（実績＋着地予想上乗せ分）
    actualAmount: number;
    forecastAmountAdd: number;
    actualAssess: number;
    forecastAssessAdd: number;
    actualContract: number;
    forecastContractAdd: number;
    memo: string;
  } | null>(null);

  const createMutation = trpc.businessMetrics.create.useMutation({
    onSuccess: () => {
      toast.success("指標を追加しました");
      utils.businessMetrics.list.invalidate();
      setDialogOpen(false);
      setEditMetric(null);
    },
    onError: (error) => toast.error(`エラー: ${error.message}`),
  });

  const updateMutation = trpc.businessMetrics.update.useMutation({
    onSuccess: () => {
      toast.success("指標を更新しました");
      utils.businessMetrics.list.invalidate();
      setDialogOpen(false);
      setEditMetric(null);
    },
    onError: (error) => toast.error(`エラー: ${error.message}`),
  });

  const deleteMutation = trpc.businessMetrics.delete.useMutation({
    onSuccess: () => {
      toast.success("指標を削除しました");
      utils.businessMetrics.list.invalidate();
    },
    onError: (error) => toast.error(`エラー: ${error.message}`),
  });

  const handleSave = () => {
    if (!editMetric) return;
    const isCurrentYear = editMetric.year === currentYear;
    if (editMetric.id) {
      updateMutation.mutate({
        id: editMetric.id,
        year: editMetric.year,
        totalTransactionAmount: editMetric.totalTransactionAmount || undefined,
        assessmentCount: editMetric.assessmentCount || undefined,
        contractCount: editMetric.contractCount || undefined,
        // 本年のみ実績・予想上乗せ分を保存
        ...(isCurrentYear ? {
          actualAmount: editMetric.actualAmount || undefined,
          forecastAmountAdd: editMetric.forecastAmountAdd || undefined,
          actualAssess: editMetric.actualAssess || undefined,
          forecastAssessAdd: editMetric.forecastAssessAdd || undefined,
          actualContract: editMetric.actualContract || undefined,
          forecastContractAdd: editMetric.forecastContractAdd || undefined,
        } : {}),
        memo: editMetric.memo || undefined,
      });
    } else {
      createMutation.mutate({
        year: editMetric.year,
        totalTransactionAmount: editMetric.totalTransactionAmount || undefined,
        assessmentCount: editMetric.assessmentCount || undefined,
        contractCount: editMetric.contractCount || undefined,
        // 本年のみ実績・予想上乗せ分を保存
        ...(isCurrentYear ? {
          actualAmount: editMetric.actualAmount || undefined,
          forecastAmountAdd: editMetric.forecastAmountAdd || undefined,
          actualAssess: editMetric.actualAssess || undefined,
          forecastAssessAdd: editMetric.forecastAssessAdd || undefined,
          actualContract: editMetric.actualContract || undefined,
          forecastContractAdd: editMetric.forecastContractAdd || undefined,
        } : {}),
        memo: editMetric.memo || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold">ビジネス指標</h2>
        <Button
          className="bg-black hover:bg-gray-800"
          onClick={() => {
            setEditMetric({
              year: currentYear,
              totalTransactionAmount: 0,
              assessmentCount: 0,
              contractCount: 0,
              actualAmount: 0,
              forecastAmountAdd: 0,
              actualAssess: 0,
              forecastAssessAdd: 0,
              actualContract: 0,
              forecastContractAdd: 0,
              memo: "",
            });
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          新規追加
        </Button>
      </div>

      <div className="grid gap-4">
        {metrics && metrics.length > 0 ? (
          metrics.map((metric) => {
            const contractRate = metric.assessmentCount && metric.assessmentCount > 0
              ? Math.round((metric.contractCount || 0) / metric.assessmentCount * 100)
              : 0;
            return (
              <Card key={metric.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{metric.year}年度</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditMetric({
                            id: metric.id,
                            year: metric.year,
                            totalTransactionAmount: metric.totalTransactionAmount || 0,
                            assessmentCount: metric.assessmentCount || 0,
                            contractCount: metric.contractCount || 0,
                            actualAmount: metric.actualAmount || 0,
                            forecastAmountAdd: metric.forecastAmountAdd || 0,
                            actualAssess: metric.actualAssess || 0,
                            forecastAssessAdd: metric.forecastAssessAdd || 0,
                            actualContract: metric.actualContract || 0,
                            forecastContractAdd: metric.forecastContractAdd || 0,
                            memo: metric.memo || "",
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("この指標を削除しますか？")) {
                            deleteMutation.mutate({ id: metric.id });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">累計取扱高</p>
                      <p className="text-xl font-bold">
                        {metric.totalTransactionAmount
                          ? `¥${metric.totalTransactionAmount.toLocaleString()}`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">査定数</p>
                      <p className="text-xl font-bold">
                        {metric.assessmentCount || "-"}件
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">成約数</p>
                      <p className="text-xl font-bold">
                        {metric.contractCount || "-"}件
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">成約率</p>
                      <p className="text-xl font-bold text-green-600">
                        {contractRate}%
                      </p>
                    </div>
                  </div>
                  {metric.memo && (
                    <p className="text-sm text-gray-500 mt-2">メモ: {metric.memo}</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
              <LineChart className="w-12 h-12 mb-4 opacity-50" />
              <p>まだ指標データがありません</p>
              <p className="text-sm">「新規追加」ボタンから年度別の指標を追加してください</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 指標編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editMetric?.id ? "指標を編集" : "新規指標を追加"}</DialogTitle>
            <DialogDescription>年度別のビジネス指標を入力してください</DialogDescription>
          </DialogHeader>
          {editMetric && (
            <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2">
              <div className="grid gap-2">
                <Label htmlFor="metricYear">年度 *</Label>
                <Input
                  id="metricYear"
                  type="number"
                  value={editMetric.year}
                  onChange={(e) => setEditMetric({ ...editMetric, year: parseInt(e.target.value) || 0 })}
                  placeholder="2024"
                />
              </div>
              {/* 本年の場合は実績＋予想上乗せ分を入力 */}
              {editMetric.year === currentYear ? (
                <>
                  {/* 取扱高 */}
                  <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
                    <p className="text-sm font-semibold text-blue-700">取扱高（本年）</p>
                    <div className="grid gap-2">
                      <Label htmlFor="actualAmount">実績累計（円）</Label>
                      <Input
                        id="actualAmount"
                        type="number"
                        value={editMetric.actualAmount || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, actualAmount: parseInt(e.target.value) || 0 })}
                        placeholder="72000000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="forecastAmountAdd">着地予想上乗せ分（円）</Label>
                      <Input
                        id="forecastAmountAdd"
                        type="number"
                        value={editMetric.forecastAmountAdd || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, forecastAmountAdd: parseInt(e.target.value) || 0 })}
                        placeholder="28000000"
                      />
                      <p className="text-xs text-gray-500">合計: ¥{((editMetric.actualAmount || 0) + (editMetric.forecastAmountAdd || 0)).toLocaleString()}</p>
                    </div>
                  </div>
                  {/* 査定数 */}
                  <div className="border rounded-lg p-4 space-y-3 bg-green-50">
                    <p className="text-sm font-semibold text-green-700">査定数（本年）</p>
                    <div className="grid gap-2">
                      <Label htmlFor="actualAssess">実績累計（件）</Label>
                      <Input
                        id="actualAssess"
                        type="number"
                        value={editMetric.actualAssess || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, actualAssess: parseInt(e.target.value) || 0 })}
                        placeholder="150"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="forecastAssessAdd">着地予想上乗せ分（件）</Label>
                      <Input
                        id="forecastAssessAdd"
                        type="number"
                        value={editMetric.forecastAssessAdd || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, forecastAssessAdd: parseInt(e.target.value) || 0 })}
                        placeholder="50"
                      />
                      <p className="text-xs text-gray-500">合計: {(editMetric.actualAssess || 0) + (editMetric.forecastAssessAdd || 0)}件</p>
                    </div>
                  </div>
                  {/* 成約数 */}
                  <div className="border rounded-lg p-4 space-y-3 bg-orange-50">
                    <p className="text-sm font-semibold text-orange-700">成約数（本年）</p>
                    <div className="grid gap-2">
                      <Label htmlFor="actualContract">実績累計（件）</Label>
                      <Input
                        id="actualContract"
                        type="number"
                        value={editMetric.actualContract || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, actualContract: parseInt(e.target.value) || 0 })}
                        placeholder="140"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="forecastContractAdd">着地予想上乗せ分（件）</Label>
                      <Input
                        id="forecastContractAdd"
                        type="number"
                        value={editMetric.forecastContractAdd || ""}
                        onChange={(e) => setEditMetric({ ...editMetric, forecastContractAdd: parseInt(e.target.value) || 0 })}
                        placeholder="20"
                      />
                      <p className="text-xs text-gray-500">合計: {(editMetric.actualContract || 0) + (editMetric.forecastContractAdd || 0)}件</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 過去年・未来年は従来の入力欄 */}
                  <div className="grid gap-2">
                    <Label htmlFor="metricAmount">累計取扱高（円）</Label>
                    <Input
                      id="metricAmount"
                      type="number"
                      value={editMetric.totalTransactionAmount || ""}
                      onChange={(e) => setEditMetric({ ...editMetric, totalTransactionAmount: parseInt(e.target.value) || 0 })}
                      placeholder="10000000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="metricAssessment">査定数</Label>
                    <Input
                      id="metricAssessment"
                      type="number"
                      value={editMetric.assessmentCount || ""}
                      onChange={(e) => setEditMetric({ ...editMetric, assessmentCount: parseInt(e.target.value) || 0 })}
                      placeholder="100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="metricContract">成約数</Label>
                    <Input
                      id="metricContract"
                      type="number"
                      value={editMetric.contractCount || ""}
                      onChange={(e) => setEditMetric({ ...editMetric, contractCount: parseInt(e.target.value) || 0 })}
                      placeholder="50"
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="metricMemo">メモ</Label>
                <Textarea
                  id="metricMemo"
                  value={editMetric.memo}
                  onChange={(e) => setEditMetric({ ...editMetric, memo: e.target.value })}
                  placeholder="備考など"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// アクセス解析パネルコンポーネント
function AnalyticsPanel() {
  const { data: analyticsData, isLoading } = trpc.analytics.getStats.useQuery();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const stats = analyticsData || {
    today: 0,
    yesterday: 0,
    last7Days: 0,
    last30Days: 0,
    dailyStats: [],
  };

  // 前日比の計算
  const todayChange = stats.yesterday > 0 
    ? Math.round(((stats.today - stats.yesterday) / stats.yesterday) * 100) 
    : stats.today > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">アクセス解析</h2>
      
      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              今日
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today.toLocaleString()}</div>
            <div className={cn(
              "text-xs flex items-center gap-1",
              todayChange >= 0 ? "text-green-600" : "text-red-600"
            )}>
              <TrendingUp className="w-3 h-3" />
              {todayChange >= 0 ? "+" : ""}{todayChange}% 前日比
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              昨日
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.yesterday.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              過去7日
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last7Days.toLocaleString()}</div>
            <div className="text-xs text-gray-500">
              平均 {Math.round(stats.last7Days / 7).toLocaleString()}/日
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              過去30日
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last30Days.toLocaleString()}</div>
            <div className="text-xs text-gray-500">
              平均 {Math.round(stats.last30Days / 30).toLocaleString()}/日
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ページ別アクセス数（過去30日） */}
      <Card>
        <CardHeader>
          <CardTitle>ページ別アクセス数（過去30日）</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.pageStats && stats.pageStats.length > 0 ? (
            <div className="space-y-2">
              {stats.pageStats.map((page: { path: string; label: string; count: number }) => (
                <div key={page.path} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-28 truncate">{page.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (page.count / Math.max(...stats.pageStats.map((p: { count: number }) => p.count), 1)) * 100)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{page.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">まだデータがありません</p>
          )}
        </CardContent>
      </Card>

      {/* 日別データテーブル */}
      <Card>
        <CardHeader>
          <CardTitle>日別アクセス数（過去14日）</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.dailyStats && stats.dailyStats.length > 0 ? (
            <div className="space-y-2">
              {stats.dailyStats.map((day: { date: string; count: number }, index: number) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-24">{day.date}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-black h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (day.count / Math.max(...stats.dailyStats.map((d: { count: number }) => d.count), 1)) * 100)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{day.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">まだデータがありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();

  // 車両データ
  const { data: vehicles, isLoading: vehiclesLoading } = trpc.vehicles.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // 買取実績データ
  const { data: purchaseRecords, isLoading: recordsLoading } = trpc.purchaseRecords.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // スライドショーメディアデータ
  const { data: slideshowMedia, isLoading: slideshowLoading } = trpc.slideshowMedia.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // 最新情報データ
  const { data: newsItems, isLoading: newsLoading } = trpc.newsItems.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  // 新規車両フォーム
  const [newVehicle, setNewVehicle] = useState({
    title: "",
    priceDisplay: "",
    description: "",
    videoUrl: "",
    imageUrl: "",
    status: "在庫あり" as "在庫あり" | "商談中" | "売約済み",
    isPublished: true,
    isConsignment: false,
  });

  // 新規買取実績フォーム
  const [newRecord, setNewRecord] = useState({
    vehicleName: "",
    purchasePrice: 0,
    priceDisplay: "",
    comment: "",
    imageUrl: "",
    isPublished: true,
  });

  // 新規スライドショーメディア追加フォーム
  const [newMedia, setNewMedia] = useState({
    type: "image" as "image" | "video",
    url: "",
    title: "",
    displayOrder: 0,
    isPublished: true,
  });

  // 新規最新情報フォーム
  const [newNewsItem, setNewNewsItem] = useState({
    title: "",
    url: "",
    isPublished: true,
  });

  // ダイアログ状態
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  
  // 編集対象
  type VehicleType = NonNullable<typeof vehicles>[number];
  type RecordType = NonNullable<typeof purchaseRecords>[number];
  type MediaType = NonNullable<typeof slideshowMedia>[number];
  type NewsItemType = NonNullable<typeof newsItems>[number];
  const [editVehicle, setEditVehicle] = useState<VehicleType | null>(null);
  const [editRecord, setEditRecord] = useState<RecordType | null>(null);
  const [editMedia, setEditMedia] = useState<MediaType | null>(null);
  const [editNewsItem, setEditNewsItem] = useState<NewsItemType | null>(null);

  // 全動画サムネイル一括修正
  const fixAllThumbnailsMutation = trpc.bunnyStream.fixAllThumbnails.useMutation({
    onSuccess: (result) => {
      toast.success(`サムネイルS3生成完了: ${result.success}件成功 / ${result.total}件中`);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  // 全動画を先頭フレームに設定（Bunny API のみ、S3・DB更新なし）
  const setAllToFrame0Mutation = trpc.bunnyStream.setAllToFrame0.useMutation({
    onSuccess: (result) => {
      toast.success(`先頭フレーム設定完了: ${result.success}件成功 / ${result.total}件中。ギャラリーを再読み込みしてください。`);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  // DB上のサムネイルURLリセット
  const resetAllThumbnailsMutation = trpc.bunnyStream.resetAllThumbnailUrls.useMutation({
    onSuccess: () => {
      toast.success('サムネイルURLをリセットしました。ギャラリーページを再読み込みしてください。');
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  // Mutations
  const createVehicleMutation = trpc.vehicles.create.useMutation({
    onSuccess: () => {
      toast.success("車両を追加しました");
      utils.vehicles.listAll.invalidate();
      setVehicleDialogOpen(false);
      setNewVehicle({ title: "", priceDisplay: "", description: "", videoUrl: "", imageUrl: "", status: "在庫あり", isPublished: true, isConsignment: false });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteVehicleMutation = trpc.vehicles.delete.useMutation({
    onMutate: async ({ id }) => {
      // ★ 楽観的更新: DB応答前に即座にリストから除外
      await utils.vehicles.listAll.cancel();
      const prev = utils.vehicles.listAll.getData();
      utils.vehicles.listAll.setData(undefined, (old: any) =>
        old ? old.filter((v: any) => v.id !== id) : old
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("車両を削除しました");
      utils.vehicles.listAll.invalidate();
    },
    onError: (error, _vars, ctx) => {
      // エラー時はロールバック
      if (ctx?.prev) utils.vehicles.listAll.setData(undefined, ctx.prev);
      toast.error(`エラー: ${error.message}`);
    },
  });

  const createRecordMutation = trpc.purchaseRecords.create.useMutation({
    onSuccess: () => {
      toast.success("買取実績を追加しました");
      utils.purchaseRecords.listAll.invalidate();
      setRecordDialogOpen(false);
      setNewRecord({ vehicleName: "", purchasePrice: 0, priceDisplay: "", comment: "", imageUrl: "", isPublished: true });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteRecordMutation = trpc.purchaseRecords.delete.useMutation({
    onSuccess: () => {
      toast.success("買取実績を削除しました");
      utils.purchaseRecords.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const createMediaMutation = trpc.slideshowMedia.create.useMutation({
    onSuccess: () => {
      toast.success("スライドショーメディアを追加しました");
      utils.slideshowMedia.listAll.invalidate();
      setMediaDialogOpen(false);
      setNewMedia({ type: "image", url: "", title: "", displayOrder: 0, isPublished: true });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteMediaMutation = trpc.slideshowMedia.delete.useMutation({
    onSuccess: () => {
      toast.success("スライドショーメディアを削除しました");
      utils.slideshowMedia.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const reorderMediaMutation = trpc.slideshowMedia.reorder.useMutation({
    onSuccess: () => {
      toast.success("順序を更新しました");
      utils.slideshowMedia.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  // 最新情報のmutations
  const createNewsItemMutation = trpc.newsItems.create.useMutation({
    onSuccess: () => {
      toast.success("最新情報を追加しました");
      utils.newsItems.listAll.invalidate();
      setNewsDialogOpen(false);
      setNewNewsItem({ title: "", url: "", isPublished: true });
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const updateNewsItemMutation = trpc.newsItems.update.useMutation({
    onSuccess: () => {
      toast.success("最新情報を更新しました");
      utils.newsItems.listAll.invalidate();
      setEditNewsItem(null);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const deleteNewsItemMutation = trpc.newsItems.delete.useMutation({
    onSuccess: () => {
      toast.success("最新情報を削除しました");
      utils.newsItems.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const reorderNewsItemsMutation = trpc.newsItems.reorder.useMutation({
    onSuccess: () => {
      toast.success("順序を更新しました");
      utils.newsItems.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const reorderRecordsMutation = trpc.purchaseRecords.reorder.useMutation({
    onSuccess: () => {
      toast.success("順序を更新しました");
      utils.purchaseRecords.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const reorderVehiclesMutation = trpc.vehicles.reorder.useMutation({
    onSuccess: () => {
      toast.success("順序を更新しました");
      utils.vehicles.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  // 車両の並び替え
  const moveVehicle = (index: number, direction: 'up' | 'down') => {
    if (!vehicles) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= vehicles.length) return;

    const items = vehicles.map((v, i) => ({
      id: v.id,
      displayOrder: i === index ? newIndex : i === newIndex ? index : i,
    }));

    reorderVehiclesMutation.mutate({ items });
  };

  // 買取実績の並び替え
  const moveRecord = (index: number, direction: 'up' | 'down') => {
    if (!purchaseRecords) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= purchaseRecords.length) return;

    const items = purchaseRecords.map((r, i) => ({
      id: r.id,
      displayOrder: i === index ? newIndex : i === newIndex ? index : i,
    }));

    reorderRecordsMutation.mutate({ items });
  };

  // スライドショーの並び替え
  const moveMedia = (index: number, direction: 'up' | 'down') => {
    if (!slideshowMedia) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slideshowMedia.length) return;

    const items = slideshowMedia.map((m, i) => ({
      id: m.id,
      displayOrder: i === index ? newIndex : i === newIndex ? index : i,
    }));

    reorderMediaMutation.mutate({ items });
  };

  // 最新情報の並び替え
  const moveNewsItem = (index: number, direction: 'up' | 'down') => {
    if (!newsItems) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newsItems.length) return;

    const items = newsItems.map((n, i) => ({
      id: n.id,
      displayOrder: i === index ? newIndex : i === newIndex ? index : i,
    }));

    reorderNewsItemsMutation.mutate({ items });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">管理画面</CardTitle>
            <CardDescription>ログインが必要です</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-black hover:bg-gray-800">
              <a href={getLoginUrl()}>ログイン</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">アクセス拒否</CardTitle>
            <CardDescription>管理者権限が必要です</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              この画面にアクセスするには管理者権限が必要です。
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                トップページに戻る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 bg-white text-gray-900">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-black">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg md:text-xl font-bold">管理画面</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-sm text-gray-600 hidden md:inline">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="w-4 h-4 md:mr-2" />
              <span>ログアウト</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="vehicles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="vehicles" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2">
              <Car className="w-4 h-4" />
              <span className="hidden sm:inline">在庫管理</span>
              <span className="sm:hidden">在庫</span>
            </TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">買取実績</span>
              <span className="sm:hidden">実績</span>
            </TabsTrigger>
            <TabsTrigger value="slideshow" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">スライドショー</span>
              <span className="sm:hidden">スライド</span>
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2">
              <Newspaper className="w-4 h-4" />
              <span className="hidden sm:inline">最新情報</span>
              <span className="sm:hidden">情報</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2">
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">指標</span>
              <span className="sm:hidden">指標</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm py-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">アクセス解析</span>
              <span className="sm:hidden">PV</span>
            </TabsTrigger>
          </TabsList>

          {/* 在庫管理タブ */}
          <TabsContent value="vehicles">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">在庫車両</h2>
              <div className="flex items-center gap-2">
              <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-gray-800">
                    <Plus className="w-4 h-4 mr-1 md:mr-2" />
                    <span>新規追加</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>新規車両を追加</DialogTitle>
                    <DialogDescription>在庫に新しい車両を追加します</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">車両名 *</Label>
                      <Input
                        id="title"
                        value={newVehicle.title}
                        onChange={(e) => setNewVehicle({ ...newVehicle, title: e.target.value })}
                        placeholder="例: Toyota Crown Athlete 2.5"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="priceDisplay">価格表示 *</Label>
                      <Input
                        id="priceDisplay"
                        value={newVehicle.priceDisplay}
                        onChange={(e) => setNewVehicle({ ...newVehicle, priceDisplay: e.target.value })}
                        placeholder="例: 598,000- または お問い合わせください"
                      />
                      <p className="text-xs text-gray-500">そのまま表示されます（例: 598,000- 、ASK、お問い合わせください）</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">説明</Label>
                      <Textarea
                        id="description"
                        value={newVehicle.description}
                        onChange={(e) => setNewVehicle({ ...newVehicle, description: e.target.value })}
                        placeholder="車両の詳細説明"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>メイン画像をアップロード</Label>
                      <FileUploader
                        folder="vehicles"
                        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                        label="画像を選択"
                        currentUrl={newVehicle.imageUrl}
                        onUpload={(url) => setNewVehicle({ ...newVehicle, imageUrl: url })}
                      />
                      <p className="text-xs text-gray-500">追加の画像・動画は車両作成後に「編集」→「メディアを管理」から追加できます</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="status">ステータス</Label>
                      <Select
                        value={newVehicle.status}
                        onValueChange={(value: "在庫あり" | "商談中" | "売約済み") => setNewVehicle({ ...newVehicle, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="在庫あり">在庫あり</SelectItem>
                          <SelectItem value="商談中">商談中</SelectItem>
                          <SelectItem value="売約済み">売約済み</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="published"
                        checked={newVehicle.isPublished}
                        onCheckedChange={(checked) => setNewVehicle({ ...newVehicle, isPublished: checked })}
                      />
                      <Label htmlFor="published">公開する</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="consignment"
                        checked={newVehicle.isConsignment}
                        onCheckedChange={(checked) => setNewVehicle({ ...newVehicle, isConsignment: checked })}
                      />
                      <Label htmlFor="consignment">委託車両</Label>
                    </div>
                    {newVehicle.isConsignment && (
                      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        ※委託車両は「委託在庫一覧」タブに表示されます
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createVehicleMutation.mutate(newVehicle)}
                      disabled={!newVehicle.title || !newVehicle.priceDisplay || createVehicleMutation.isPending}
                      className="bg-black hover:bg-gray-800"
                    >
                      {createVehicleMutation.isPending ? "追加中..." : "追加"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            {vehiclesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : vehicles && vehicles.length > 0 ? (
              <div className="grid gap-4">
                {vehicles.map((vehicle, index) => (
                  <Card key={vehicle.id}>
                    <CardContent className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4">
                      {/* 並び替えボタン */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveVehicle(index, 'up')}
                          disabled={index === 0 || reorderVehiclesMutation.isPending}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveVehicle(index, 'down')}
                          disabled={index === vehicles.length - 1 || reorderVehiclesMutation.isPending}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="w-full md:w-24 h-32 md:h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {vehicle.videoUrl ? (
                          <video src={vehicle.videoUrl} className="w-full h-full object-cover" />
                        ) : vehicle.imageUrl ? (
                          <img src={vehicle.imageUrl} alt={vehicle.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Car className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{vehicle.title}</h3>
                        <p className="text-lg font-bold text-green-600">
                          {vehicle.priceDisplay || (vehicle.price ? `¥${vehicle.price.toLocaleString()}` : '価格未設定')}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded ${vehicle.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {vehicle.isPublished ? '公開中' : '非公開'}
                          </span>
                          {vehicle.isConsignment && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              委託車両
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-none"
                          onClick={() => setEditVehicle(vehicle)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          <span>編集</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-none text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (confirm('この車両を削除しますか？')) {
                              deleteVehicleMutation.mutate({ id: vehicle.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          <span>削除</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Car className="w-12 h-12 mb-4 opacity-50" />
                  <p>まだ車両がありません</p>
                  <p className="text-sm">「新規追加」ボタンから車両を追加してください</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 買取実績タブ */}
          <TabsContent value="records">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">買取実績</h2>
              <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-gray-800">
                    <Plus className="w-4 h-4 mr-1 md:mr-2" />
                    <span>新規追加</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>新規買取実績を追加</DialogTitle>
                    <DialogDescription>買取実績を追加します</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleName">車両名 *</Label>
                      <Input
                        id="vehicleName"
                        value={newRecord.vehicleName}
                        onChange={(e) => setNewRecord({ ...newRecord, vehicleName: e.target.value })}
                        placeholder="例: トヨタ ヴィッツ"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="purchasePrice">買取価格（円） *</Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        value={newRecord.purchasePrice || ""}
                        onChange={(e) => setNewRecord({ ...newRecord, purchasePrice: parseInt(e.target.value) || 0 })}
                        placeholder="例: 350000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="priceDisplay">価格表示（任意）</Label>
                      <Input
                        id="priceDisplay"
                        value={newRecord.priceDisplay}
                        onChange={(e) => setNewRecord({ ...newRecord, priceDisplay: e.target.value })}
                        placeholder="例: 35万円"
                      />
                      <p className="text-xs text-gray-500">空欄の場合は自動で「○万円」形式で表示されます</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="comment">コメント</Label>
                      <Textarea
                        id="comment"
                        value={newRecord.comment}
                        onChange={(e) => setNewRecord({ ...newRecord, comment: e.target.value })}
                        placeholder="例: 他社より5万円高く買取！"
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>画像をアップロード</Label>
                      <FileUploader
                        folder="purchase-records"
                        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                        label="画像を選択"
                        currentUrl={newRecord.imageUrl}
                        onUpload={(url) => setNewRecord({ ...newRecord, imageUrl: url })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="recordPublished"
                        checked={newRecord.isPublished}
                        onCheckedChange={(checked) => setNewRecord({ ...newRecord, isPublished: checked })}
                      />
                      <Label htmlFor="recordPublished">公開する</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        const maxOrder = purchaseRecords?.reduce((max, r) => Math.max(max, r.displayOrder || 0), 0) || 0;
                        createRecordMutation.mutate({ ...newRecord, displayOrder: maxOrder + 1 });
                      }}
                      disabled={!newRecord.vehicleName || !newRecord.purchasePrice || createRecordMutation.isPending}
                      className="bg-black hover:bg-gray-800"
                    >
                      {createRecordMutation.isPending ? "追加中..." : "追加"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              上下ボタンで表示順序を変更できます。会社概要ページに表示されます。
            </p>

            {recordsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : purchaseRecords && purchaseRecords.length > 0 ? (
              <div className="grid gap-2">
                {purchaseRecords.map((record, index) => (
                  <Card key={record.id}>
                    <CardContent className="flex items-center gap-2 p-3">
                      {/* 並び替えボタン */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveRecord(index, 'up')}
                          disabled={index === 0 || reorderRecordsMutation.isPending}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveRecord(index, 'down')}
                          disabled={index === purchaseRecords.length - 1 || reorderRecordsMutation.isPending}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate text-sm">{record.vehicleName}</h3>
                        <p className="text-green-600 font-bold">
                          {record.priceDisplay || `${(record.purchasePrice / 10000).toLocaleString()}万円`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditRecord(record)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => {
                            if (confirm('この買取実績を削除しますか？')) {
                              deleteRecordMutation.mutate({ id: record.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <DollarSign className="w-12 h-12 mb-4 opacity-50" />
                  <p>まだ買取実績がありません</p>
                  <p className="text-sm">「新規追加」ボタンから買取実績を追加してください</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* スライドショータブ */}
          <TabsContent value="slideshow">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">スライドショーメディア</h2>
              <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-gray-800">
                    <Plus className="w-4 h-4 mr-1 md:mr-2" />
                    <span>新規追加</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>スライドショーメディアを追加</DialogTitle>
                    <DialogDescription>会社概要ページの背景スライドショーに表示する画像・動画を追加します</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>メディアタイプ</Label>
                      <Select value={newMedia.type} onValueChange={(value: "image" | "video") => setNewMedia({ ...newMedia, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">画像</SelectItem>
                          <SelectItem value="video">動画</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>メディアをアップロード *</Label>
                      <FileUploader
                        folder="slideshow"
                        accept={newMedia.type === "video" ? "video/*,.mp4,.mov,.avi,.webm" : "image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"}
                        label={newMedia.type === "video" ? "動画を選択" : "画像を選択"}
                        currentUrl={newMedia.url}
                        onUpload={(url) => setNewMedia({ ...newMedia, url })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mediaTitle">タイトル（管理用）</Label>
                      <Input
                        id="mediaTitle"
                        value={newMedia.title}
                        onChange={(e) => setNewMedia({ ...newMedia, title: e.target.value })}
                        placeholder="例: ガレージ外観"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="mediaPublished"
                        checked={newMedia.isPublished}
                        onCheckedChange={(checked) => setNewMedia({ ...newMedia, isPublished: checked })}
                      />
                      <Label htmlFor="mediaPublished">公開する</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        const maxOrder = slideshowMedia?.reduce((max, m) => Math.max(max, m.displayOrder || 0), 0) || 0;
                        createMediaMutation.mutate({ ...newMedia, displayOrder: maxOrder + 1 });
                      }}
                      disabled={!newMedia.url || createMediaMutation.isPending}
                      className="bg-black hover:bg-gray-800"
                    >
                      {createMediaMutation.isPending ? "追加中..." : "追加"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              上下ボタンで表示順序を変更できます。会社概要ページの背景スライドショーに表示されます。
              <br />
              <span className="text-xs text-blue-600">※画像は自動的に最適化されます（最大1920px、5MB以下に圧縮）</span>
            </p>

            {slideshowLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              </div>
            ) : slideshowMedia && slideshowMedia.length > 0 ? (
              <div className="grid gap-2">
                {slideshowMedia.map((media, index) => (
                  <Card key={media.id}>
                    <CardContent className="flex items-center gap-2 p-3">
                      {/* 並び替えボタン */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveMedia(index, 'up')}
                          disabled={index === 0 || reorderMediaMutation.isPending}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveMedia(index, 'down')}
                          disabled={index === slideshowMedia.length - 1 || reorderMediaMutation.isPending}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* サムネイル */}
                      <div className="w-16 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {media.type === 'video' ? (
                          <video src={media.url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={media.url} alt={media.title || ''} className="w-full h-full object-cover" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {media.type === 'video' ? (
                            <Video className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Image className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {media.title || `${media.type === 'video' ? '動画' : '画像'} #${index + 1}`}
                          </span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${media.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {media.isPublished ? '公開中' : '非公開'}
                        </span>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditMedia(media)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => {
                            if (confirm('このメディアを削除しますか？')) {
                              deleteMediaMutation.mutate({ id: media.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Images className="w-12 h-12 mb-4 opacity-50" />
                  <p>まだスライドショーメディアがありません</p>
                  <p className="text-sm">「新規追加」ボタンから画像・動画を追加してください</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 最新情報タブ */}
          <TabsContent value="news">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold">最新情報</h2>
              <Dialog open={newsDialogOpen} onOpenChange={setNewsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-black hover:bg-gray-800">
                    <Plus className="w-4 h-4 mr-1 md:mr-2" />
                    <span>新規追加</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>新規最新情報を追加</DialogTitle>
                    <DialogDescription>Googleビジネスプロフィールの投稿などの最新情報を追加します。</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="newsTitle">タイトル *</Label>
                      <Input
                        id="newsTitle"
                        value={newNewsItem.title}
                        onChange={(e) => setNewNewsItem({ ...newNewsItem, title: e.target.value })}
                        placeholder="例: 新車入荷のお知らせ"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="newsUrl">URL *</Label>
                      <Input
                        id="newsUrl"
                        value={newNewsItem.url}
                        onChange={(e) => setNewNewsItem({ ...newNewsItem, url: e.target.value })}
                        placeholder="例: https://g.co/kgs/xxxxx"
                      />
                      <p className="text-xs text-gray-500">Googleビジネスプロフィールの投稿URLなど</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="newsPublished"
                        checked={newNewsItem.isPublished}
                        onCheckedChange={(checked) => setNewNewsItem({ ...newNewsItem, isPublished: checked })}
                      />
                      <Label htmlFor="newsPublished">公開する</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (!newNewsItem.title || !newNewsItem.url) {
                          toast.error("タイトルとURLは必須です");
                          return;
                        }
                        createNewsItemMutation.mutate(newNewsItem);
                      }}
                      disabled={createNewsItemMutation.isPending}
                    >
                      {createNewsItemMutation.isPending ? "追加中..." : "追加"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {newsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : newsItems && newsItems.length > 0 ? (
              <div className="grid gap-2">
                {newsItems.map((item, index) => (
                  <Card key={item.id}>
                    <CardContent className="flex items-center gap-2 p-3">
                      {/* 並び替えボタン */}
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveNewsItem(index, 'up')}
                          disabled={index === 0 || reorderNewsItemsMutation.isPending}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveNewsItem(index, 'down')}
                          disabled={index === newsItems.length - 1 || reorderNewsItemsMutation.isPending}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* アイコン */}
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <Newspaper className="w-5 h-5 text-gray-500" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{item.title}</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${item.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {item.isPublished ? '公開中' : '非公開'}
                          </span>
                          <span className="text-xs text-gray-500 truncate">{item.url}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditNewsItem(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => {
                            if (confirm('この最新情報を削除しますか？')) {
                              deleteNewsItemMutation.mutate({ id: item.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Newspaper className="w-12 h-12 mb-4 opacity-50" />
                  <p>まだ最新情報がありません</p>
                  <p className="text-sm">「新規追加」ボタンから情報を追加してください</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ビジネス指標タブ */}
          <TabsContent value="metrics">
            <BusinessMetricsPanel />
          </TabsContent>

          {/* アクセス解析タブ */}
          <TabsContent value="analytics">
            <AnalyticsPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* 編集ダイアログ */}
      {editVehicle && (
        <VehicleEditDialog
          vehicle={editVehicle}
          open={!!editVehicle}
          onOpenChange={(open) => !open && setEditVehicle(null)}
          onSuccess={() => utils.vehicles.listAll.invalidate()}
        />
      )}

      {editRecord && (
        <RecordEditDialog
          record={editRecord}
          open={!!editRecord}
          onOpenChange={(open) => !open && setEditRecord(null)}
          onSuccess={() => utils.purchaseRecords.listAll.invalidate()}
        />
      )}

      {editMedia && (
        <MediaEditDialog
          media={editMedia}
          open={!!editMedia}
          onOpenChange={(open) => !open && setEditMedia(null)}
          onSuccess={() => utils.slideshowMedia.listAll.invalidate()}
        />
      )}

      {/* 最新情報編集ダイアログ */}
      {editNewsItem && (
        <Dialog open={!!editNewsItem} onOpenChange={(open) => !open && setEditNewsItem(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>最新情報を編集</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editNewsTitle">タイトル *</Label>
                <Input
                  id="editNewsTitle"
                  value={editNewsItem.title}
                  onChange={(e) => setEditNewsItem({ ...editNewsItem, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editNewsUrl">URL *</Label>
                <Input
                  id="editNewsUrl"
                  value={editNewsItem.url}
                  onChange={(e) => setEditNewsItem({ ...editNewsItem, url: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="editNewsPublished"
                  checked={editNewsItem.isPublished ?? false}
                  onCheckedChange={(checked) => setEditNewsItem({ ...editNewsItem, isPublished: checked })}
                />
                <Label htmlFor="editNewsPublished">公開する</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditNewsItem(null)}>
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  if (!editNewsItem.title || !editNewsItem.url) {
                    toast.error("タイトルとURLは必須です");
                    return;
                  }
                  updateNewsItemMutation.mutate({
                    id: editNewsItem.id,
                    title: editNewsItem.title,
                    url: editNewsItem.url,
                    isPublished: editNewsItem.isPublished ?? true,
                  });
                }}
                disabled={updateNewsItemMutation.isPending}
              >
                {updateNewsItemMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
