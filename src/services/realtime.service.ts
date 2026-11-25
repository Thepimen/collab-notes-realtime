import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.client';
import type {
  BroadcastContentDeltaDTO,
  DocumentDTO,
  PresenceUserDTO,
  ProfileDTO
} from '@/types/domain.types';

export interface RealtimeRoomCallbacks {
  readonly onPresenceSync: (users: readonly PresenceUserDTO[]) => void;
  readonly onBroadcastDelta: (delta: BroadcastContentDeltaDTO) => void;
  readonly onPostgresDocumentUpdate: (updatedDoc: Partial<DocumentDTO> & { id: string; version: number }) => void;
  readonly onPostgresCollaboratorChange: (documentId: string) => void;
}

interface LocalBusPacket {
  readonly channelName: string;
  readonly eventType:
    | 'PRESENCE_JOIN_OR_UPDATE'
    | 'PRESENCE_LEAVE'
    | 'BROADCAST_DELTA'
    | 'POSTGRES_DOC_UPDATE'
    | 'POSTGRES_COLLAB_CHANGE';
  readonly tabId: string;
  readonly payload: unknown;
}

const COLLABORATOR_COLORS: readonly string[] = [
  '#C84B31', // Terracotta Vermilion
  '#2A6F4E', // Sage Pine
  '#B87314', // Ochre Amber
  '#1F6E7A', // Deep Petrol
  '#8C4A32', // Raw Sienna
  '#4E5D4E'  // Olive Slate
];

export function pickColorForUser(userId: string): string {
  if (userId.startsWith('11111111')) return '#C84B31';
  if (userId.startsWith('22222222')) return '#2A6F4E';
  if (userId.startsWith('33333333')) return '#B87314';
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[index] ?? '#C84B31';
}

/**
 * Active Realtime Room Session Handle
 * Encapsulates both Supabase Elixir/Phoenix WebSocket channel (`room:doc_${documentId}`)
 * and local BroadcastChannel synchronization for multi-tab resilience.
 */
export class DocumentRealtimeChannel {
  private readonly documentId: string;
  private readonly channelName: string;
  private readonly currentUser: ProfileDTO;
  private readonly callbacks: RealtimeRoomCallbacks;
  private readonly tabId: string;
  private supabaseChannel: RealtimeChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private readonly localPeers = new Map<string, PresenceUserDTO>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentPresenceState: PresenceUserDTO;

  public constructor(params: {
    readonly documentId: string;
    readonly currentUser: ProfileDTO;
    readonly effectiveRole: PresenceUserDTO['role'];
    readonly callbacks: RealtimeRoomCallbacks;
  }) {
    this.documentId = params.documentId;
    this.channelName = `room:doc_${params.documentId}`;
    this.currentUser = params.currentUser;
    this.callbacks = params.callbacks;
    this.tabId = `${params.currentUser.id}_${Math.random().toString(36).slice(2, 8)}`;

    this.currentPresenceState = {
      userId: params.currentUser.id,
      email: params.currentUser.email,
      fullName: params.currentUser.fullName,
      avatarUrl: params.currentUser.avatarUrl,
      role: params.effectiveRole,
      isTyping: false,
      activeBlockId: null,
      lastActiveAt: new Date().toISOString(),
      color: pickColorForUser(params.currentUser.id)
    };
  }

  /**
   * Connects to `room:doc_${documentId}` via Supabase Realtime WebSockets
   * and binds Presence, Broadcast, and Postgres Changes listeners.
   */
  public subscribe(): void {
    // 1. Register self in presence map immutably
    this.localPeers.set(this.tabId, { ...this.currentPresenceState });
    this.emitConsolidatedPresence();

    // 2. Setup Cross-Tab WebSocket / BroadcastChannel bridge
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('collabnotes_realtime_ws_v1');
      this.broadcastChannel.onmessage = (event: MessageEvent<LocalBusPacket>) => {
        const packet = event.data;
        if (!packet || packet.channelName !== this.channelName) return;

        switch (packet.eventType) {
          case 'PRESENCE_JOIN_OR_UPDATE': {
            const peer = packet.payload as PresenceUserDTO;
            const isNewTab = !this.localPeers.has(packet.tabId) && packet.tabId !== this.tabId;
            this.localPeers.set(packet.tabId, { ...peer });
            this.emitConsolidatedPresence();
            if (isNewTab) {
              this.postLocalBusPacket('PRESENCE_JOIN_OR_UPDATE', this.currentPresenceState);
            }
            break;
          }
          case 'PRESENCE_LEAVE': {
            this.localPeers.delete(packet.tabId);
            this.emitConsolidatedPresence();
            break;
          }
          case 'BROADCAST_DELTA': {
            if (packet.tabId !== this.tabId) {
              this.callbacks.onBroadcastDelta(packet.payload as BroadcastContentDeltaDTO);
            }
            break;
          }
          case 'POSTGRES_DOC_UPDATE': {
            if (packet.tabId !== this.tabId) {
              this.callbacks.onPostgresDocumentUpdate(
                packet.payload as Partial<DocumentDTO> & { id: string; version: number }
              );
            }
            break;
          }
          case 'POSTGRES_COLLAB_CHANGE': {
            this.callbacks.onPostgresCollaboratorChange(this.documentId);
            break;
          }
        }
      };

      // Announce initial presence to peer tabs
      this.postLocalBusPacket('PRESENCE_JOIN_OR_UPDATE', this.currentPresenceState);

      this.heartbeatTimer = setInterval(() => {
        this.currentPresenceState = {
          ...this.currentPresenceState,
          lastActiveAt: new Date().toISOString()
        };
        this.localPeers.set(this.tabId, { ...this.currentPresenceState });
        this.postLocalBusPacket('PRESENCE_JOIN_OR_UPDATE', this.currentPresenceState);
      }, 4000);
    }

    // 3. Connect to Supabase Elixir/Phoenix Realtime Engine when configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const channel = supabase.channel(this.channelName, {
        config: {
          presence: {
            key: this.currentUser.id
          },
          broadcast: {
            self: false,
            ack: false
          }
        }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PresenceUserDTO>();
          Object.entries(state).forEach(([key, presences]) => {
            const latest = presences[0];
            if (latest) {
              this.localPeers.set(`sb_${key}`, { ...latest });
            }
          });
          this.emitConsolidatedPresence();
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          this.localPeers.delete(`sb_${key}`);
          this.emitConsolidatedPresence();
        })
        .on('broadcast', { event: 'doc:content_delta' }, ({ payload }) => {
          if (payload) {
            this.callbacks.onBroadcastDelta(payload as BroadcastContentDeltaDTO);
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents',
            filter: `id=eq.${this.documentId}`
          },
          (payload) => {
            if (payload.eventType === 'UPDATE' && payload.new) {
              const row = payload.new as {
                id: string;
                title: string;
                content: DocumentDTO['content'];
                version: number;
                updated_at: string;
              };
              this.callbacks.onPostgresDocumentUpdate({
                id: row.id,
                title: row.title,
                content: row.content,
                version: row.version,
                updatedAt: row.updated_at
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'document_collaborators',
            filter: `document_id=eq.${this.documentId}`
          },
          () => {
            this.callbacks.onPostgresCollaboratorChange(this.documentId);
          }
        )
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track(this.currentPresenceState);
          }
        });

      this.supabaseChannel = channel;
    }
  }

  /**
   * Updates the current user's typing indicator and active block in Presence.
   */
  public async updateTypingPresence(params: {
    readonly isTyping: boolean;
    readonly activeBlockId: string | null;
  }): Promise<void> {
    this.currentPresenceState = {
      ...this.currentPresenceState,
      isTyping: params.isTyping,
      activeBlockId: params.activeBlockId,
      lastActiveAt: new Date().toISOString()
    };

    this.localPeers.set(this.tabId, { ...this.currentPresenceState });
    this.emitConsolidatedPresence();
    this.postLocalBusPacket('PRESENCE_JOIN_OR_UPDATE', this.currentPresenceState);

    if (this.supabaseChannel && isSupabaseConfigured()) {
      try {
        await this.supabaseChannel.track(this.currentPresenceState);
      } catch (error) {
        console.warn('[RealtimeService] Failed to track presence:', error);
      }
    }
  }

  /**
   * Broadcasts low-latency live edits over WebSockets (`doc:content_delta`) before debounced DB save.
   */
  public async broadcastContentDelta(delta: BroadcastContentDeltaDTO): Promise<void> {
    this.postLocalBusPacket('BROADCAST_DELTA', delta);

    if (this.supabaseChannel && isSupabaseConfigured()) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'doc:content_delta',
          payload: delta
        });
      } catch (error) {
        console.warn('[RealtimeService] Broadcast send error:', error);
      }
    }
  }

  /**
   * Emits a committed Postgres document version update across connected clients.
   */
  public notifyCommittedDocumentUpdate(
    doc: Partial<DocumentDTO> & { id: string; version: number }
  ): void {
    this.postLocalBusPacket('POSTGRES_DOC_UPDATE', doc);
  }

  /**
   * Emits a collaborator permission table update notification.
   */
  public notifyCollaboratorChange(): void {
    this.postLocalBusPacket('POSTGRES_COLLAB_CHANGE', { documentId: this.documentId });
  }

  /**
   * Injects a simulated remote collaborator into Presence for interactive OCC demonstration.
   */
  public injectSimulatedCollaboratorPresence(peer: PresenceUserDTO): void {
    const simKey = `sim_${peer.userId}`;
    this.localPeers.set(simKey, { ...peer });
    this.emitConsolidatedPresence();
    this.postLocalBusPacket('PRESENCE_JOIN_OR_UPDATE', peer);

    setTimeout(() => {
      const existing = this.localPeers.get(simKey);
      if (existing) {
        this.localPeers.set(simKey, { ...existing, isTyping: false });
        this.emitConsolidatedPresence();
      }
    }, 3500);
  }

  /**
   * Unsubscribes and cleans up WebSocket and BroadcastChannel resources.
   */
  public async unsubscribe(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.postLocalBusPacket('PRESENCE_LEAVE', { userId: this.currentUser.id });

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.supabaseChannel && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        await this.supabaseChannel.untrack();
        await supabase.removeChannel(this.supabaseChannel);
      } catch (error) {
        console.warn('[RealtimeService] Cleanup warning:', error);
      }
      this.supabaseChannel = null;
    }
  }

  private postLocalBusPacket(
    eventType: LocalBusPacket['eventType'],
    payload: unknown
  ): void {
    if (!this.broadcastChannel) return;
    try {
      const packet: LocalBusPacket = {
        channelName: this.channelName,
        eventType,
        tabId: this.tabId,
        payload
      };
      this.broadcastChannel.postMessage(packet);
    } catch {
      // Ignore closed channel errors during teardown
    }
  }

  private emitConsolidatedPresence(): void {
    // Deduplicate peers by userId while preferring active typing state
    const byUserId = new Map<string, PresenceUserDTO>();
    this.localPeers.forEach((peer) => {
      const existing = byUserId.get(peer.userId);
      if (!existing || peer.isTyping || peer.lastActiveAt > existing.lastActiveAt) {
        byUserId.set(peer.userId, { ...peer });
      }
    });

    const immutableList = Array.from(byUserId.values());
    this.callbacks.onPresenceSync(immutableList);
  }
}
