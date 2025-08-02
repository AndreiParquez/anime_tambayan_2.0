"use client";

import axios from "axios";
import { useEffect, useState, useRef } from "react";
import Hls from "hls.js";

export default function About() {
  const [animeData, setAnimeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  const loadHLSVideo = (url: string, isHLS: boolean, sourceIndex: number = 0) => {
    if (!videoRef.current) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;

    if (isHLS) {
      if (Hls.isSupported()) {
        console.log("HLS.js is supported, loading HLS stream");
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          backBufferLength: 90,
          // Add codec compatibility settings
          forceKeyFrameOnDiscontinuity: true,
          abrEwmaDefaultEstimate: 500000,
          abrEwmaSlowVoD: 3,
          abrEwmaFastVoD: 3,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Try to handle codec issues
          enableSoftwareAES: true,
          xhrSetup: function(xhr: XMLHttpRequest, url: string) {
            // Route ALL HLS requests through our proxy to fix CORS
            // But don't double-proxy URLs that are already going through our proxy
            if (!url.startsWith('/api/proxy') && (url.includes('padorupado.ru') || url.includes('.m3u8') || url.includes('.ts') || url.includes('.key') || url.includes('.jpg'))) {
              const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
              xhr.open('GET', proxyUrl, true);
              return; // Important: return here to prevent default behavior
            }
          }
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed successfully");
          setVideoLoading(false);
          setVideoError("✅ HLS stream loaded successfully!");
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", event, data);
          setVideoLoading(false);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Trying to recover from network error");
                hls.startLoad();
                setVideoError("⚠️ Network error - attempting recovery...");
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Trying to recover from media/codec error");
                if (data.details === 'bufferAddCodecError') {
                  // Try next quality source if available
                  if (animeData?.sources && sourceIndex < animeData.sources.length - 1) {
                    const nextSource = animeData.sources[sourceIndex + 1];
                    setVideoError(`❌ Codec error - trying next quality: ${nextSource.quality}...`);
                    setTimeout(() => {
                      loadHLSVideo(nextSource.url, nextSource.isM3U8, sourceIndex + 1);
                    }, 1000);
                  } else {
                    setVideoError("❌ Codec not supported by browser. All qualities failed.");
                  }
                } else {
                  hls.recoverMediaError();
                  setVideoError("⚠️ Media error - attempting recovery...");
                }
                break;
              default:
                console.log("Cannot recover from this error");
                setVideoError(`❌ Fatal error: ${data.details || 'Unknown error'}`);
                break;
            }
          } else {
            // Non-fatal error, just log it
            setVideoError(`⚠️ Warning: ${data.details || 'Minor error occurred'}`);
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("Native HLS support detected");
        video.src = url;
        setVideoLoading(false);
        setVideoError("✅ Using native HLS support");
      } else {
        console.error("HLS not supported");
        setVideoLoading(false);
        setVideoError("❌ HLS not supported in this browser");
      }
    } else {
      // Regular MP4 video
      console.log("Loading MP4 video");
      video.src = url;
      setVideoLoading(false);
      setVideoError("✅ Loading MP4 video");
    }
  };

  useEffect(() => {
    async function fetchData() {
      // Testing different API endpoints - the original might be wrong format
      const animeId = "df337ebc-7f73-0f3b-516d-6ebd5808590d";
      const episodeId = "9a7d825bc23c3872aa672bf9230ba4ddd1778b90e16c13111041e4831f4ee386";
      
      // Try different possible endpoint formats
      const possibleUrls = [
        `https://consumetapi-roan.vercel.app/anime/animepahe/watch?episodeId=${animeId}/${episodeId}`,
        `https://consumetapi-roan.vercel.app/anime/animepahe/watch/${animeId}/${episodeId}`,
        `https://consumetapi-roan.vercel.app/anime/animepahe/watch/${episodeId}`,
        `https://consumetapi-roan.vercel.app/anime/animepahe/episode-sources?id=${animeId}/${episodeId}`,
        `https://consumetapi-roan.vercel.app/anime/animepahe/episode-sources/${animeId}/${episodeId}`,
      ];

      let triedUrls: string[] = [];

      // Try multiple URL formats until one works
      for (let i = 0; i < possibleUrls.length; i++) {
        const currentUrl = possibleUrls[i];
        triedUrls.push(currentUrl);
        
        try {
          console.log(`Attempt ${i + 1}: Trying URL:`, currentUrl);
          const response = await axios.get(currentUrl);
          setAnimeData(response.data);
          console.log("Success! Response status:", response.status);
          console.log("Working URL:", currentUrl);
          console.log("Anime data:", response.data);
          setLoading(false);
          
          // Auto-load video directly after successful API fetch
          setTimeout(() => {
            if (response.data?.sources?.[0]) {
              console.log("Auto-loading video (HLS.js will proxy individual requests)...");
              setVideoLoading(true);
              setVideoError('🎥 Auto-loading video with HLS.js (smart proxy)...');
              setCurrentSourceIndex(0);
              loadHLSVideo(response.data.sources[0].url, response.data.sources[0].isM3U8, 0);
            }
          }, 500); // Small delay to ensure UI is ready
          
          return; // Exit on success
        } catch (err) {
          const axiosErr = err as any;
          console.error(`Attempt ${i + 1} failed:`, axiosErr.response?.status, axiosErr.response?.statusText);
          
          if (i === possibleUrls.length - 1) {
            // Last attempt failed, set final error
            if (axios.isAxiosError(err)) {
              setError(`All ${possibleUrls.length} URL formats failed. Last error: HTTP ${axiosErr.response?.status}: ${axiosErr.response?.statusText || axiosErr.message}`);
              console.error("Final error - Response data:", axiosErr.response?.data);
            } else {
              setError(err instanceof Error ? err.message : "An error occurred");
            }
            console.error("All attempts failed. Tried URLs:", triedUrls);
            setLoading(false);
          }
        }
      }
    }

    fetchData();
  }, []);

  const loadVideoWithProxy = () => {
    if (videoRef.current && animeData?.sources?.[0]) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(animeData.sources[0].url)}`;
      console.log("Loading video with proxy:", proxyUrl);
      setVideoLoading(true);
      setVideoError('🔄 Loading via proxy with HLS.js...');
      setCurrentSourceIndex(0);
      loadHLSVideo(proxyUrl, animeData.sources[0].isM3U8, 0);
    }
  };

  const loadVideoDirectly = () => {
    if (videoRef.current && animeData?.sources?.[0]) {
      // Load directly without proxy, rely on xhrSetup to proxy individual requests
      console.log("Loading video directly (HLS.js will proxy individual requests):", animeData.sources[0].url);
      setVideoLoading(true);
      setVideoError('🎥 Loading directly with HLS.js (smart proxy)...');
      setCurrentSourceIndex(0);
      loadHLSVideo(animeData.sources[0].url, animeData.sources[0].isM3U8, 0);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  if (loading) {
    return (
      <main style={{ padding: '20px' }}>
        <h1>Loading...</h1>
        <p>Fetching episode data...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: '20px' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '20px' }}>
      <h1>Anime Tambayan - Video Player</h1>
      <p>Testing video streaming functionality</p>
      
      {loading && (
        <div style={{ marginTop: '20px' }}>
          <p>Loading episode data...</p>
        </div>
      )}
      
      {error && (
        <div style={{ color: 'red', marginTop: '20px' }}>
          <h3>Error:</h3>
          <p>{error}</p>
        </div>
      )}
      
      {animeData?.sources && (
        <>
          {videoError && (
            <div style={{ color: 'orange', marginBottom: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
              <strong>Video Status:</strong> {videoError}
            </div>
          )}
          
          {/* Debug Info */}
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h4>🔍 Debug Info:</h4>
            {animeData.sources && (
              <div>
                <p><strong>Available Sources:</strong> {animeData.sources.length}</p>
                <p><strong>First Source URL:</strong> <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>{animeData.sources[0]?.url}</code></p>
                <p><strong>Format:</strong> {animeData.sources[0]?.isM3U8 ? 'HLS (M3U8)' : 'MP4'}</p>
                <p><strong>Quality:</strong> {animeData.sources[0]?.quality}</p>
              </div>
            )}
          </div>

          {/* Test Proxy Button */}
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
            <h4>🧪 Test Proxy:</h4>
            <button
              onClick={async () => {
                if (animeData.sources?.[0]) {
                  const proxyUrl = `/api/proxy?url=${encodeURIComponent(animeData.sources[0].url)}`;
                  console.log('Testing proxy URL:', proxyUrl);
                  
                  try {
                    const response = await fetch(proxyUrl);
                    console.log('Proxy test response:', response.status, response.statusText);
                    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
                    
                    if (response.ok) {
                      const content = await response.text();
                      console.log('Content preview (first 200 chars):', content.substring(0, 200));
                      setVideoError(`✅ Proxy test successful! Status: ${response.status}`);
                    } else {
                      setVideoError(`❌ Proxy test failed! Status: ${response.status}`);
                    }
                  } catch (err) {
                    console.error('Proxy test error:', err);
                    setVideoError(`❌ Proxy test error: ${err}`);
                  }
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🧪 Test Proxy Connection
            </button>
          </div>

          {/* Video Player */}
          <div style={{ marginBottom: '20px' }}>
            <video 
              ref={videoRef}
              controls 
              width="100%" 
              height="500"
              style={{ backgroundColor: '#000', borderRadius: '8px' }}
              onError={(e) => {
                console.error('Video error event:', e);
                console.error('Video error target:', e.target);
                const target = e.target as HTMLVideoElement;
                const errorCode = target.error?.code || 'unknown';
                const errorMessage = target.error?.message || 'Unknown video error';
                setVideoError(`❌ Video error (code: ${errorCode}): ${errorMessage}`);
              }}
              onLoadStart={() => {
                console.log('Video loading started...');
              }}
              onCanPlay={() => {
                console.log('Video can play!');
                if (!videoError?.includes('✅')) {
                  setVideoError('✅ Video ready to play!');
                }
              }}
              onLoadedData={() => {
                console.log('Video data loaded!');
              }}
              onPlay={() => {
                console.log('Video started playing');
              }}
              onWaiting={() => {
                console.log('Video buffering...');
              }}
            >
              Your browser does not support the video tag.
            </video>
            
            {/* HLS Support Info */}
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              <p>
                <strong>HLS Support:</strong> {Hls.isSupported() ? '✅ HLS.js available' : '❌ HLS.js not supported'} | 
                <strong> Native HLS:</strong> {videoRef.current?.canPlayType('application/vnd.apple.mpegurl') ? '✅ Supported' : '❌ Not supported'}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div style={{ marginBottom: '20px' }}>
            <h3>🔄 Video Loading Options:</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={loadVideoWithProxy}
                disabled={videoLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: videoLoading ? 'not-allowed' : 'pointer',
                  opacity: videoLoading ? 0.6 : 1
                }}
              >
                🔄 Load via Proxy (HLS.js)
              </button>
              
              <button
                onClick={loadVideoDirectly}
                disabled={videoLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: videoLoading ? 'not-allowed' : 'pointer',
                  opacity: videoLoading ? 0.6 : 1
                }}
              >
                🎥 Load Direct (HLS.js)
              </button>

              <button
                onClick={() => {
                  if (animeData?.sources && currentSourceIndex < animeData.sources.length - 1) {
                    const nextIndex = currentSourceIndex + 1;
                    const nextSource = animeData.sources[nextIndex];
                    setVideoLoading(true);
                    setVideoError(`🔄 Trying next quality: ${nextSource.quality}...`);
                    setCurrentSourceIndex(nextIndex);
                    loadHLSVideo(nextSource.url, nextSource.isM3U8, nextIndex);
                  }
                }}
                disabled={videoLoading || !animeData?.sources || currentSourceIndex >= animeData.sources.length - 1}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ffc107',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (videoLoading || !animeData?.sources || currentSourceIndex >= animeData.sources.length - 1) ? 'not-allowed' : 'pointer',
                  opacity: (videoLoading || !animeData?.sources || currentSourceIndex >= animeData.sources.length - 1) ? 0.6 : 1
                }}
              >
                ⏭️ Try Next Quality
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
              💡 <strong>Tip:</strong> If you get codec errors, try different qualities. Some browsers don't support certain audio codecs.
              <br />
              📱 <strong>Current quality:</strong> {animeData?.sources?.[currentSourceIndex]?.quality || 'Unknown'} 
              ({currentSourceIndex + 1}/{animeData?.sources?.length || 0})
            </p>
          </div>

          {/* Quality Options */}
          <div style={{ marginBottom: '20px' }}>
            <h4>Available Qualities:</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {animeData.sources.map((source: any, index: number) => (
                <button
                  key={index}
                  onClick={() => {
                    if (videoRef.current) {
                      const currentTime = videoRef.current.currentTime;
                      setVideoLoading(true);
                      setVideoError('🎥 Loading new quality with HLS.js (smart proxy)...');
                      setCurrentSourceIndex(index);
                      loadHLSVideo(source.url, source.isM3U8, index);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007acc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {source.quality} {source.isM3U8 ? '(HLS)' : '(MP4)'}
                </button>
              ))}
            </div>
          </div>

          {/* Episode Info */}
          <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <h4>Episode Info:</h4>
            <p><strong>Quality:</strong> {animeData.sources[0].quality}</p>
            <p><strong>Format:</strong> {animeData.sources[0].isM3U8 ? 'HLS (M3U8)' : 'MP4'}</p>
            <p><strong>Video URL:</strong></p>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#e9ecef', 
              padding: '8px', 
              borderRadius: '4px',
              fontSize: '12px',
              wordBreak: 'break-all'
            }}>
              {animeData.sources[0].url}
            </code>
          </div>

          {/* Alternative: Direct Links */}
          <div style={{ marginBottom: '20px' }}>
            <h4>📺 Direct Video Links (Right-click → Open in new tab):</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {animeData.sources.map((source: any, index: number) => (
                <div key={index} style={{ padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>{source.quality} {source.isM3U8 ? '(HLS)' : '(MP4)'}</strong>
                  <br />
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#007acc', wordBreak: 'break-all' }}
                  >
                    {source.url}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Headers Info */}
          {animeData.headers && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Required Headers:</h4>
              <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                {animeData.headers.Referer && (
                  <p><strong>Referer:</strong> {animeData.headers.Referer}</p>
                )}
                {animeData.headers['User-Agent'] && (
                  <p><strong>User-Agent:</strong> {animeData.headers['User-Agent']}</p>
                )}
                {animeData.headers.watchsb && (
                  <p><strong>WatchSB:</strong> {animeData.headers.watchsb}</p>
                )}
              </div>
            </div>
          )}

          {/* Raw Data for Debugging */}
          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              View Raw API Response
            </summary>
            <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto', marginTop: '10px' }}>
              {JSON.stringify(animeData, null, 2)}
            </pre>
          </details>
        </>
      )}

      {animeData && !animeData.sources && (
        <div style={{ color: 'orange' }}>
          <h3>No video sources found</h3>
          <p>The API returned data but no playable video sources.</p>
        </div>
      )}
    </main>
  );
}
