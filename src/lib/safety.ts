import { Alert } from '@/lib/alert';
import { blockUser, report } from '@/lib/api';
import { emit } from '@/lib/events';
import type { ReportReason } from '@/lib/types';
import type { SheetOption } from '@/providers/ActionSheetProvider';

type Show = (config: { title?: string; message?: string; options: SheetOption[] }) => void;

const REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'spam', label: 'Spam or scam' },
  { reason: 'harassment', label: 'Harassment or bullying' },
  { reason: 'nudity', label: 'Nudity or sexual content' },
  { reason: 'violence', label: 'Violence or dangerous acts' },
  { reason: 'misinformation', label: 'False information' },
  { reason: 'other', label: 'Something else' },
];

/** Opens the report-reason sheet and files the report. */
export function openReport(show: Show, target: { videoId?: string; commentId?: string; userId?: string }) {
  show({
    title: 'Why are you reporting this?',
    message: 'Your report is anonymous. Our team reviews every report.',
    options: REASONS.map(({ reason, label }) => ({
      label,
      onPress: () =>
        report(target, reason)
          .then(() => Alert.alert('Thanks for letting us know', 'We’ll review this and take action if it breaks our guidelines.'))
          .catch((e) => Alert.alert('Couldn’t send report', e instanceof Error ? e.message : String(e))),
    })),
  });
}

export function confirmBlock(userId: string, username: string, onDone?: () => void) {
  Alert.alert(`Block @${username}?`, 'They won’t be able to find your videos, message you or follow you. They won’t be notified.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: () =>
        blockUser(userId)
          .then(() => {
            emit('blocked', { userId });
            onDone?.();
          })
          .catch((e) => Alert.alert('Couldn’t block', e instanceof Error ? e.message : String(e))),
    },
  ]);
}
