import { useState, useRef, useCallback } from 'react';
import { HeaderBackButton } from "@/components/common/BackButton";
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import EmptyState from '@/shared/ui/EmptyState';
import FeatureGate from '@/shared/ui/FeatureGate';
import { Mic, MicOff, FileText, ChevronRight } from 'lucide-react';
import api from '@/api/client';

interface DiaryEntry {
  id: number;
  transcript: string;
  structured_notes: string;
  client_name?: string;
  created_at: string;
}

function parseNotes(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const parts: string[] = [];
    if (parsed.note_text) parts.push(parsed.note_text);
    if (parsed.physical_params && Object.keys(parsed.physical_params).length > 0) {
      parts.push('📋 ' + Object.entries(parsed.physical_params).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
    if (parsed.preferences && Object.keys(parsed.preferences).length > 0) {
      parts.push('⭐ ' + Object.entries(parsed.preferences).map(([k, v]) => `${k}: ${v}`).join(', '));
    }
    if (parsed.allergies && parsed.allergies.length > 0) {
      parts.push('⚠️ Аллергии: ' + parsed.allergies.join(', '));
    }
    if (parsed.suggested_days_until_next) {
      parts.push(`🔄 Следующий визит через ${parsed.suggested_days_until_next} дн.`);
    }
    return parts.join('\n') || raw;
  } catch {
    return raw;
  }
}

export default function VoiceDiary() {
  return (
    <FeatureGate flag="ai_advisor">
      <VoiceDiaryContent />
    </FeatureGate>
  );
}

function VoiceDiaryContent() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ transcript: string; notes: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: entries = [], refetch } = useQuery<DiaryEntry[]>({
    queryKey: ['voice-diary'],
    queryFn: async () => {
      const resp = await api.get('/ai/voice-diary/entries');
      return resp.data;
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;

        setProcessing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          const sttResp = await fetch('/api/v1/ai/transcribe', {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
            },
          });
          const sttData = await sttResp.json();

          if (sttData.transcript) {
            const diaryResp = await aiApi.voiceDiary({ transcript: sttData.transcript });
            setLastResult({
              transcript: sttData.transcript,
              notes: diaryResp.data.structured_notes || diaryResp.data.summary || '',
            });
            refetch();
          }
        } catch {
          setLastResult({ transcript: '', notes: 'Ошибка обработки записи' });
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setLastResult({ transcript: '', notes: 'Нет доступа к микрофону' });
    }
  }, [refetch]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <div >
      <PageHeader
        title="Голосовой дневник"
        left={<HeaderBackButton to="/master/ai" />}
      />

      <div className="px-screen-x space-y-4">
        {/* Record button */}
        <div className="flex flex-col items-center py-8">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              recording
                ? 'bg-status-danger text-white animate-pulse scale-110'
                : 'bg-brand-500 text-white shadow-button'
            } disabled:opacity-40`}
          >
            {recording ? (
              <MicOff className="w-10 h-10" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>
          <p className="text-tg-hint text-sm mt-3">
            {recording
              ? 'Говорите... Нажмите чтобы остановить'
              : processing
              ? 'AI обрабатывает запись...'
              : 'Надиктуйте заметку после визита'}
          </p>
          {processing && (
            <div className="mt-2 flex gap-1.5">
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:0.15s]" />
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="bg-surface-elevated rounded-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Результат</h3>
            {lastResult.transcript && (
              <div>
                <p className="text-xs text-tg-hint mb-1">Распознанный текст:</p>
                <p className="text-sm">{lastResult.transcript}</p>
              </div>
            )}
            {lastResult.notes && (
              <div>
                <p className="text-xs text-tg-hint mb-1">AI-заметка:</p>
                <p className="text-sm whitespace-pre-wrap">{lastResult.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div>
          <h3 className="font-semibold text-sm mb-2">История записей</h3>
          {entries.length === 0 ? (
            <EmptyState
              emoji="📝"
              title="Нет записей"
              description="Надиктуйте заметку после визита — AI структурирует её"
            />
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const displayText = parseNotes(entry.structured_notes || entry.transcript);
                return (
                  <div
                    key={entry.id}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="bg-surface-elevated rounded-xl p-3 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-brand-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isExpanded ? '' : 'truncate'}`}>
                          {displayText.split('\n')[0]}
                        </p>
                        <p className="text-xs text-tg-hint">
                          {new Date(entry.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {entry.client_name && ` · ${entry.client_name}`}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-tg-hint shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-tg-section-separator space-y-2">
                        <div>
                          <p className="text-xs text-tg-hint mb-1">Распознанный текст:</p>
                          <p className="text-sm">{entry.transcript}</p>
                        </div>
                        <div>
                          <p className="text-xs text-tg-hint mb-1">AI-заметка:</p>
                          <p className="text-sm whitespace-pre-wrap">{displayText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
