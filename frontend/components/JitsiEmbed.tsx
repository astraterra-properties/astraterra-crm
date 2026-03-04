'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface JitsiEmbedProps {
  roomId: string;
  displayName: string;
  onClose: () => void;
  audioOnly?: boolean;
}

export default function JitsiEmbed({ roomId, displayName, onClose, audioOnly = false }: JitsiEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const initJitsi = () => {
      if (!containerRef.current || apiRef.current) return;

      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: roomId,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: audioOnly ? true : false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          enableWelcomePage: false,
          enableClosePage: false,
          // Audio-only: hide camera/desktop sharing buttons
          toolbarButtons: audioOnly
            ? ['microphone', 'hangup', 'fullscreen']
            : ['microphone', 'camera', 'hangup', 'fullscreen', 'tileview', 'desktop'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          HIDE_INVITE_MORE_BUTTON: true,
          MOBILE_APP_PROMO: false,
          DEFAULT_BACKGROUND: '#0a1628',
          TOOLBAR_ALWAYS_VISIBLE: true,
        },
        userInfo: {
          displayName,
        },
      });

      apiRef.current.addEventListener('readyToClose', () => {
        onClose();
      });
      apiRef.current.addEventListener('videoConferenceLeft', () => {
        onClose();
      });
    };

    if (typeof window.JitsiMeetExternalAPI !== 'undefined') {
      initJitsi();
    } else {
      // Dynamically load the Jitsi IFrame API script
      const existing = document.getElementById('jitsi-api-script');
      if (existing) {
        existing.addEventListener('load', initJitsi);
      } else {
        const script = document.createElement('script');
        script.id = 'jitsi-api-script';
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = initJitsi;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0a1628', borderRadius: '0' }}
    />
  );
}
