/**
 * Tiny app-wide event bus so screens stay in sync after optimistic updates
 * (e.g. a comment added in the sheet bumps the count on the feed behind it).
 */
type Events = {
  commentCount: { videoId: string; delta: number };
  follow: { userId: string; following: boolean };
  videoDeleted: { videoId: string };
  videoPublished: Record<string, never>;
  /** Hide a video from feeds without deleting it (e.g. "Not interested"). */
  videoHidden: { videoId: string };
  blocked: { userId: string };
  messagesRead: Record<string, never>;
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;
const handlers = new Map<keyof Events, Set<(payload: never) => void>>();

export function emit<K extends keyof Events>(event: K, payload: Events[K]) {
  handlers.get(event)?.forEach((h) => (h as Handler<K>)(payload));
}

export function on<K extends keyof Events>(event: K, handler: Handler<K>) {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(handler as (payload: never) => void);
  return () => {
    set.delete(handler as (payload: never) => void);
  };
}
