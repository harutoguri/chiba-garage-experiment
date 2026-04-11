import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getProxiedVideoUrl, isIOSSafari } from "@/lib/videoUrl";

// テスト用MP4 URL（データベースから取得した実際のURL）
const ORIGINAL_VIDEO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663305386043/4WnCpiyyV5zEiwX2YFQ52L/vehicles/9X9yBcWSRo0RzWwoWNJEj.mp4";

export default function VideoDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [videoState, setVideoState] = useState<Record<string, string>>({});
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const tapVideoRef = useRef<HTMLVideoElement>(null);
  const [showTapVideo, setShowTapVideo] = useState(false);
  const [hideBgVideo, setHideBgVideo] = useState(false);
  const [useProxy, setUseProxy] = useState(true); // デフォルトでプロキシを使用
  const [networkInfo, setNetworkInfo] = useState<string>("");

  // 使用するURL（プロキシ経由または直接）
  const videoUrl = useProxy ? getProxiedVideoUrl(ORIGINAL_VIDEO_URL) : ORIGINAL_VIDEO_URL;

  // データベースから動画URLを取得
  const { data: vehicles } = trpc.vehicles.list.useQuery();

  useEffect(() => {
    if (vehicles && vehicles.length > 0) {
      const firstVehicle = vehicles[0];
      if (firstVehicle) {
        log(`Found vehicle: ${firstVehicle.title} (ID: ${firstVehicle.id})`);
      }
    }
  }, [vehicles]);

  const log = (msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    setLogs((prev) => [...prev.slice(-30), `[${timestamp}] ${msg}`]);
  };

  const updateVideoState = (video: HTMLVideoElement | null, label: string) => {
    if (!video) return;
    setVideoState((prev) => ({
      ...prev,
      [`${label}_readyState`]: String(video.readyState),
      [`${label}_networkState`]: String(video.networkState),
      [`${label}_currentTime`]: video.currentTime.toFixed(2),
      [`${label}_paused`]: String(video.paused),
      [`${label}_muted`]: String(video.muted),
      [`${label}_error`]: video.error ? video.error.message : "none",
      [`${label}_videoWidth`]: String(video.videoWidth),
      [`${label}_videoHeight`]: String(video.videoHeight),
    }));
  };

  // ネットワーク情報を取得
  const checkNetworkInfo = async () => {
    log("Checking network info...");
    try {
      const response = await fetch(videoUrl, { method: 'HEAD' });
      const headers: string[] = [];
      response.headers.forEach((value, key) => {
        headers.push(`${key}: ${value}`);
      });
      const info = `Status: ${response.status}\n${headers.join('\n')}`;
      setNetworkInfo(info);
      log(`Network check: ${response.status} ${response.statusText}`);
      log(`Content-Type: ${response.headers.get('content-type')}`);
      log(`Accept-Ranges: ${response.headers.get('accept-ranges')}`);
      log(`Content-Length: ${response.headers.get('content-length')}`);
    } catch (err) {
      const error = err as Error;
      log(`Network check failed: ${error.message}`);
      setNetworkInfo(`Error: ${error.message}`);
    }
  };

  // Range requestをテスト
  const checkRangeRequest = async () => {
    log("Testing Range request...");
    try {
      const response = await fetch(videoUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1023'
        }
      });
      log(`Range request: ${response.status} ${response.statusText}`);
      if (response.status === 206) {
        log("✓ Range request supported (206 Partial Content)");
      } else if (response.status === 200) {
        log("✗ Range request NOT supported (200 OK instead of 206)");
      }
    } catch (err) {
      const error = err as Error;
      log(`Range request failed: ${error.message}`);
    }
  };

  // canPlayType チェック
  const checkCanPlayType = () => {
    const video = document.createElement("video");
    const types = [
      'video/mp4',
      'video/mp4; codecs="avc1.42E01E"',
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      'video/mp4; codecs="hvc1"',
      'video/webm',
      'application/vnd.apple.mpegurl',
    ];
    types.forEach((type) => {
      const result = video.canPlayType(type);
      log(`canPlayType("${type}"): ${result || "empty"}`);
    });
  };

  // 背景動画を停止
  const stopBgVideo = () => {
    log("stopBgVideo called");
    if (bgVideoRef.current) {
      bgVideoRef.current.pause();
      bgVideoRef.current.currentTime = 0;
      log("Background video stopped");
      updateVideoState(bgVideoRef.current, "bg");
    }
  };

  // 背景動画を再生
  const playBgVideo = () => {
    log("playBgVideo called");
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.volume = 0;
      const playPromise = bgVideoRef.current.play();
      if (playPromise) {
        playPromise
          .then(() => {
            log("Background video play() SUCCESS");
            updateVideoState(bgVideoRef.current, "bg");
          })
          .catch((err) => {
            log(`Background video play() FAILED: ${err.name} - ${err.message}`);
            updateVideoState(bgVideoRef.current, "bg");
          });
      }
    }
  };

  // タップ再生（ユーザー操作イベント内で実行）
  const playTapVideo = () => {
    log("playTapVideo called");
    setShowTapVideo(true);
    log("Tap video element created");
    
    // 次のフレームで再生開始（要素がDOMに追加された後）
    setTimeout(() => {
      if (tapVideoRef.current) {
        tapVideoRef.current.muted = false;
        tapVideoRef.current.volume = 1;
        
        const playPromise = tapVideoRef.current.play();
        if (playPromise) {
          playPromise
            .then(() => {
              log("Tap video play() SUCCESS");
              updateVideoState(tapVideoRef.current, "tap");
            })
            .catch((err) => {
              log(`Tap video play() FAILED: ${err.name} - ${err.message}`);
              updateVideoState(tapVideoRef.current, "tap");
            });
        }
      }
    }, 100);
  };

  // タップ再生を停止
  const stopTapVideo = () => {
    log("stopTapVideo called");
    if (tapVideoRef.current) {
      tapVideoRef.current.pause();
      tapVideoRef.current.currentTime = 0;
    }
    setShowTapVideo(false);
    log("Tap video stopped and removed");
  };

  // 背景動画の表示/非表示を切り替え
  const toggleBgVideoVisibility = () => {
    setHideBgVideo(!hideBgVideo);
    log(`Background video ${!hideBgVideo ? "HIDDEN" : "VISIBLE"}`);
  };

  // プロキシ使用の切り替え
  const toggleProxy = () => {
    setUseProxy(!useProxy);
    log(`Proxy ${!useProxy ? "ENABLED" : "DISABLED"}`);
  };

  // 定期的に状態を更新
  useEffect(() => {
    const interval = setInterval(() => {
      updateVideoState(bgVideoRef.current, "bg");
      if (showTapVideo) {
        updateVideoState(tapVideoRef.current, "tap");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showTapVideo]);

  // 初期化時にcanPlayTypeをチェック
  useEffect(() => {
    log("Page loaded");
    log(`iOS Safari: ${isIOSSafari() ? "YES" : "NO"}`);
    log(`Proxy: ${useProxy ? "ENABLED" : "DISABLED"}`);
    checkCanPlayType();
    log(`User Agent: ${navigator.userAgent.substring(0, 80)}...`);
  }, []);

  // URLが変更されたらネットワーク情報を再チェック
  useEffect(() => {
    checkNetworkInfo();
    checkRangeRequest();
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-black text-white p-4 relative" style={{ zIndex: 1 }}>
      <h1 className="text-xl font-bold mb-4">Video Debug Page</h1>
      
      {/* コントロールボタン */}
      <div className="mb-4 flex gap-2 flex-wrap relative" style={{ zIndex: 100 }}>
        <Button 
          onClick={toggleProxy}
          onTouchEnd={(e) => {
            e.preventDefault();
            toggleProxy();
          }}
          variant={useProxy ? "default" : "secondary"}
          size="sm"
          className="touch-manipulation"
          style={{ position: 'relative', zIndex: 100 }}
        >
          {useProxy ? "Proxy: ON" : "Proxy: OFF"}
        </Button>
        <Button 
          onClick={checkNetworkInfo}
          onTouchEnd={(e) => {
            e.preventDefault();
            checkNetworkInfo();
          }}
          variant="secondary" 
          size="sm"
          className="touch-manipulation"
          style={{ position: 'relative', zIndex: 100 }}
        >
          Check Network
        </Button>
        <Button 
          onClick={checkRangeRequest}
          onTouchEnd={(e) => {
            e.preventDefault();
            checkRangeRequest();
          }}
          variant="secondary" 
          size="sm"
          className="touch-manipulation"
          style={{ position: 'relative', zIndex: 100 }}
        >
          Test Range
        </Button>
        <Button 
          onClick={toggleBgVideoVisibility}
          onTouchEnd={(e) => {
            e.preventDefault();
            toggleBgVideoVisibility();
          }}
          variant="destructive" 
          size="sm"
          className="touch-manipulation"
          style={{ position: 'relative', zIndex: 100 }}
        >
          {hideBgVideo ? "Show BG" : "Hide BG"}
        </Button>
      </div>
      
      {/* 背景動画 */}
      <div className="mb-4 relative" style={{ zIndex: 1 }}>
        <h2 className="text-lg font-semibold mb-2">Background Video (muted, autoplay, loop)</h2>
        <video
          key={videoUrl} // URLが変わったら再マウント
          ref={bgVideoRef}
          src={videoUrl}
          muted
          autoPlay
          loop
          playsInline
          className="w-full max-w-md h-48 object-cover bg-gray-800"
          style={{ 
            pointerEvents: 'none',
            zIndex: 0,
            display: hideBgVideo ? 'none' : 'block'
          }}
          onLoadedMetadata={() => {
            log("BG: loadedmetadata");
            updateVideoState(bgVideoRef.current, "bg");
          }}
          onCanPlay={() => {
            log("BG: canplay");
            updateVideoState(bgVideoRef.current, "bg");
          }}
          onPlay={() => log("BG: play event")}
          onPause={() => log("BG: pause event")}
          onError={(e) => {
            const video = e.currentTarget;
            log(`BG: error - ${video.error?.message || "unknown"}`);
            updateVideoState(bgVideoRef.current, "bg");
          }}
        />
        <div className="flex gap-2 mt-2 relative" style={{ zIndex: 100 }}>
          <Button 
            onClick={playBgVideo}
            onTouchEnd={(e) => {
              e.preventDefault();
              playBgVideo();
            }}
            variant="outline" 
            size="sm"
            className="touch-manipulation"
            style={{ position: 'relative', zIndex: 100 }}
          >
            Play BG
          </Button>
          <Button 
            onClick={stopBgVideo}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopBgVideo();
            }}
            variant="outline" 
            size="sm"
            className="touch-manipulation"
            style={{ position: 'relative', zIndex: 100 }}
          >
            Stop BG
          </Button>
        </div>
      </div>

      {/* タップ再生動画 */}
      <div className="mb-4 relative" style={{ zIndex: 10 }}>
        <h2 className="text-lg font-semibold mb-2">Tap Video (with controls, sound)</h2>
        {showTapVideo ? (
          <video
            key={`tap-${videoUrl}`}
            ref={tapVideoRef}
            src={videoUrl}
            controls
            playsInline
            className="w-full max-w-md h-48 object-cover bg-gray-800"
            style={{ zIndex: 10 }}
            onLoadedMetadata={() => {
              log("TAP: loadedmetadata");
              updateVideoState(tapVideoRef.current, "tap");
            }}
            onCanPlay={() => {
              log("TAP: canplay");
              updateVideoState(tapVideoRef.current, "tap");
            }}
            onPlay={() => log("TAP: play event")}
            onPause={() => log("TAP: pause event")}
            onError={(e) => {
              const video = e.currentTarget;
              log(`TAP: error - ${video.error?.message || "unknown"}`);
              updateVideoState(tapVideoRef.current, "tap");
            }}
          />
        ) : (
          <div className="w-full max-w-md h-48 bg-gray-800 flex items-center justify-center">
            <span className="text-gray-400">Tap video not active</span>
          </div>
        )}
        <div className="flex gap-2 mt-2 relative" style={{ zIndex: 100 }}>
          <Button 
            onClick={playTapVideo}
            onTouchEnd={(e) => {
              e.preventDefault();
              playTapVideo();
            }}
            variant="default" 
            size="sm"
            className="touch-manipulation"
            style={{ position: 'relative', zIndex: 100 }}
          >
            Play Tap Video
          </Button>
          <Button 
            onClick={stopTapVideo}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopTapVideo();
            }}
            variant="outline" 
            size="sm"
            className="touch-manipulation"
            style={{ position: 'relative', zIndex: 100 }}
          >
            Stop Tap Video
          </Button>
        </div>
      </div>

      {/* 状態表示 */}
      <div className="mb-4 relative" style={{ zIndex: 1 }}>
        <h2 className="text-lg font-semibold mb-2">Video State</h2>
        <div className="bg-gray-900 p-2 rounded text-xs font-mono overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left pr-4">Property</th>
                <th className="text-left pr-4">BG</th>
                <th className="text-left">TAP</th>
              </tr>
            </thead>
            <tbody>
              {["readyState", "networkState", "currentTime", "paused", "muted", "error", "videoWidth", "videoHeight"].map((prop) => (
                <tr key={prop}>
                  <td className="pr-4 text-gray-400">{prop}</td>
                  <td className="pr-4">{videoState[`bg_${prop}`] || "-"}</td>
                  <td>{videoState[`tap_${prop}`] || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ネットワーク情報 */}
      {networkInfo && (
        <div className="mb-4 relative" style={{ zIndex: 1 }}>
          <h2 className="text-lg font-semibold mb-2">Network Info</h2>
          <div className="bg-gray-900 p-2 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
            {networkInfo}
          </div>
        </div>
      )}

      {/* ログ表示 */}
      <div className="mb-4 relative" style={{ zIndex: 1 }}>
        <h2 className="text-lg font-semibold mb-2">Logs</h2>
        <div className="bg-gray-900 p-2 rounded text-xs font-mono h-48 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="text-green-400">{l}</div>
          ))}
        </div>
      </div>

      {/* URL情報 */}
      <div className="text-xs text-gray-500 relative" style={{ zIndex: 1 }}>
        <p className="break-all">Video URL: {videoUrl}</p>
        <p className="mt-1 text-gray-600 break-all">Original: {ORIGINAL_VIDEO_URL}</p>
        <p className="mt-2 text-yellow-400">
          iOS Safari: {isIOSSafari() ? "YES" : "NO"} | Proxy: {useProxy ? "ON" : "OFF"}
        </p>
        <p className="mt-1 text-blue-400">
          Proxy provides 206 Partial Content for iOS Safari Range requests
        </p>
      </div>
    </div>
  );
}
