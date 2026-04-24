import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  findNodeHandle,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchChatSnapshot, sendChatMessage } from '../src/services/api';
import type { ChatMessage, ChatSnapshot, ChatUser } from '../src/types';

type PendingPhoto = {
  uri: string;
  ext: string;
  type: string;
};

const emptySnapshot: ChatSnapshot = {
  currentUser: null,
  onlineUsers: [],
  offlineUsers: [],
  selectedUserId: null,
  messages: [],
};

const RODRIGO_USER_ID = 2;

function getSelectableUsers(source: ChatSnapshot) {
  return [...source.onlineUsers, ...source.offlineUsers].filter((user) => user.id !== RODRIGO_USER_ID);
}

function formatTime(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getImageExtension(uri: string, mimeType?: string | null) {
  if (mimeType?.includes('png')) {
    return 'png';
  }

  if (mimeType?.includes('webp')) {
    return 'webp';
  }

  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() === 'jpeg' ? 'jpg' : match?.[1]?.toLowerCase() || 'jpg';
}

export default function ChatScreen() {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(emptySnapshot);
  const [viewerId] = useState(RODRIGO_USER_ID);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showOffline, setShowOffline] = useState(false);
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('Inicializando chat...');
  const [composerY, setComposerY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const composerRef = useRef<View>(null);

  const allUsers = useMemo(
    () => getSelectableUsers(snapshot),
    [snapshot.offlineUsers, snapshot.onlineUsers]
  );
  const visibleContacts = showOffline
    ? snapshot.offlineUsers.filter((user) => user.id !== RODRIGO_USER_ID)
    : snapshot.onlineUsers.filter((user) => user.id !== RODRIGO_USER_ID);
  const selectedUser = allUsers.find((user) => user.id === selectedUserId) ?? null;

  const applySnapshot = (nextSnapshot: ChatSnapshot, keepSelectedUserId?: number | null) => {
    setSnapshot(nextSnapshot);

    const availableUsers = getSelectableUsers(nextSnapshot);
    const nextSelected =
      keepSelectedUserId && availableUsers.some((user) => user.id === keepSelectedUserId)
        ? keepSelectedUserId
        : availableUsers.some((user) => user.id === nextSnapshot.selectedUserId)
          ? nextSnapshot.selectedUserId
          : availableUsers[0]?.id ?? null;

    setSelectedUserId(nextSelected);
  };

  const load = async (nextViewerId = viewerId, nextSelectedUserId = selectedUserId, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');
    setDebugInfo(`Carregando usuarios. viewer=${nextViewerId || 'nenhum'} selected=${nextSelectedUserId ?? 'nenhum'}`);

    try {
      const nextSnapshot = await fetchChatSnapshot(nextViewerId, nextSelectedUserId);
      applySnapshot(nextSnapshot, nextSelectedUserId);
      setDebugInfo(
        `Lista carregada. online=${nextSnapshot.onlineUsers.length} offline=${nextSnapshot.offlineUsers.length} selected=${nextSnapshot.selectedUserId ?? 'nenhum'}`
      );
    } catch (loadError) {
      const messageText = loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar o chat.';
      setError(messageText);
      setDebugInfo(`Erro ao carregar: ${messageText}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const selectContact = (user: ChatUser) => {
    setSelectedUserId(user.id);
    setMessage('');
    setPhoto(null);
    setDebugInfo(`Usuario selecionado: ${user.id} - ${user.name}. Remetente fixo=${viewerId}`);
    void load(viewerId, user.id);
  };

  const scrollToComposer = () => {
    if (!scrollRef.current) {
      return;
    }

    if (composerY > 0) {
      scrollRef.current.scrollTo({ y: Math.max(composerY - 20, 0), animated: true });
      return;
    }

    if (!composerRef.current || Platform.OS === 'web') {
      scrollRef.current.scrollToEnd({ animated: true });
      return;
    }

    const scrollHandle = findNodeHandle(scrollRef.current);
    if (!scrollHandle) {
      scrollRef.current.scrollToEnd({ animated: true });
      return;
    }

    composerRef.current.measureLayout(
      scrollHandle,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(y - 20, 0), animated: true }),
      () => scrollRef.current?.scrollToEnd({ animated: true })
    );
  };

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    const timer = setTimeout(() => {
      scrollToComposer();
      inputRef.current?.focus();
    }, 180);

    return () => clearTimeout(timer);
  }, [selectedUserId, composerY, snapshot.messages.length]);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Permissao da camera negada.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      setError('Nao foi possivel carregar a foto da camera.');
      return;
    }

    const type = asset.mimeType || 'image/jpeg';
    setPhoto({
      uri: asset.uri,
      ext: getImageExtension(asset.uri, type),
      type,
    });
  };

  const buildPhotoPayload = async () => {
    if (!photo?.uri) {
      return null;
    }

    const photoBase64 = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: 'base64',
    });

    return {
      photo_base64: photoBase64,
      photo_ext: photo.ext,
      photo_type: photo.type,
    };
  };

  const submit = async () => {
    if (!viewerId || !selectedUser || sending) {
      setDebugInfo(`Envio bloqueado. viewer=${viewerId} selected=${selectedUser?.id ?? 'nenhum'} sending=${sending}`);
      return;
    }

    if (!message.trim() && !photo) {
      setError('Digite uma mensagem ou tire uma foto antes de enviar.');
      setDebugInfo('Envio bloqueado: mensagem/foto vazia.');
      return;
    }

    setSending(true);
    setError('');
    setDebugInfo(
      `Enviando para /cliente-contestacao-criar.php. sender=${viewerId} recipient=${selectedUser.id} texto=${message.trim().length} foto=${photo ? 'sim' : 'nao'}`
    );

    try {
      const photoPayload = await buildPhotoPayload();
      const nextSnapshot = await sendChatMessage({
        sender_user_id: viewerId,
        recipient_user_id: selectedUser.id,
        message: message.trim(),
        photo_base64: photoPayload?.photo_base64,
        photo_ext: photoPayload?.photo_ext,
        photo_type: photoPayload?.photo_type,
      });

      applySnapshot(nextSnapshot, selectedUser.id);
      setMessage('');
      setPhoto(null);
      setDebugInfo(`Mensagem enviada. Mensagens retornadas=${nextSnapshot.messages.length}`);
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : 'Nao foi possivel enviar a mensagem.';
      setError(messageText);
      setDebugInfo(`Erro ao enviar: ${messageText}`);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void load(RODRIGO_USER_ID, null);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(viewerId, selectedUserId, true)} />}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Equipe</Text>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>Veja usuarios online, alterne para offline e envie mensagens com foto da camera.</Text>
        </View>

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator size="large" color="#7A6848" />
            <Text style={styles.feedbackText}>Carregando chat...</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.contactsHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Usuarios</Text>
                  <Text style={styles.mutedText}>
                    {showOffline
                      ? `${snapshot.offlineUsers.length} offline(s)`
                      : `${snapshot.onlineUsers.length} online(s)`}
                  </Text>
                </View>
                <View style={styles.statusSwitchWrap}>
                  <Text style={[styles.switchLabel, !showOffline && styles.switchLabelActive]}>Online</Text>
                  <Switch
                    value={showOffline}
                    onValueChange={setShowOffline}
                    trackColor={{ false: '#BFD3C8', true: '#D3C7B6' }}
                    thumbColor={showOffline ? '#7A6848' : '#486556'}
                  />
                  <Text style={[styles.switchLabel, showOffline && styles.switchLabelActive]}>Offline</Text>
                </View>
              </View>

              <View style={styles.contactList}>
                {visibleContacts.length ? (
                  visibleContacts.map((user) => (
                    <ContactRow
                      key={`${user.is_online ? 'on' : 'off'}-${user.id}`}
                      user={user}
                      selected={selectedUserId === user.id}
                      onPress={() => selectContact(user)}
                    />
                  ))
                ) : (
                  <Text style={styles.feedbackText}>Nenhum usuario encontrado.</Text>
                )}
              </View>
            </View>

            <View style={styles.conversationCard}>
              <View style={styles.conversationHeader}>
                <Text style={styles.sectionTitle}>{selectedUser?.name ?? 'Selecione um usuario'}</Text>
                {selectedUser ? (
                  <Text style={styles.mutedText}>
                    {selectedUser.role_label} - {selectedUser.unit_name}
                  </Text>
                ) : null}
              </View>

              <View style={styles.messages}>
                {snapshot.messages.length ? (
                  snapshot.messages.map((item) => <MessageBubble key={item.id} item={item} />)
                ) : (
                  <Text style={styles.feedbackText}>Nenhuma mensagem nesta conversa.</Text>
                )}
              </View>

              {photo ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreviewImage} />
                  <Pressable style={styles.removePhotoButton} onPress={() => setPhoto(null)}>
                    <Text style={styles.removePhotoText}>Remover foto</Text>
                  </Pressable>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.debugBox}>
                <Text style={styles.debugTitle}>Debug</Text>
                <Text style={styles.debugText}>{debugInfo}</Text>
                <Text style={styles.debugText}>Remetente fixo: #{viewerId}</Text>
                <Text style={styles.debugText}>Selecionado: {selectedUser ? `#${selectedUser.id} ${selectedUser.name}` : 'nenhum'}</Text>
              </View>

              <View
                ref={composerRef}
                collapsable={false}
                style={styles.composer}
                onLayout={(event) => setComposerY(event.nativeEvent.layout.y)}
              >
                <Pressable style={styles.cameraButton} onPress={() => void takePhoto()} disabled={!selectedUser}>
                  <Text style={styles.cameraButtonText}>Camera</Text>
                </Pressable>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Digite sua mensagem..."
                  placeholderTextColor="#8B7B6A"
                  multiline
                  editable={Boolean(selectedUser) && !sending}
                />
                <Pressable style={[styles.sendButton, sending && styles.sendButtonDisabled]} onPress={() => void submit()} disabled={!selectedUser || sending}>
                  <Text style={styles.sendButtonText}>{sending ? '...' : 'Enviar'}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ user, selected, onPress }: { user: ChatUser; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.contactRow, selected && styles.contactRowSelected]} onPress={onPress}>
      <View style={[styles.statusDot, user.is_online ? styles.statusDotOnline : styles.statusDotOffline]} />
      <View style={styles.contactInfo}>
        <View style={styles.contactTopLine}>
          <Text style={styles.contactName} numberOfLines={1}>
            {user.name}
          </Text>
          {user.unread_count > 0 ? (
            <Text style={styles.unreadBadge}>{user.unread_count}</Text>
          ) : null}
        </View>
        <Text style={styles.contactMeta} numberOfLines={1}>
          {user.role_label} - {user.unit_name}
        </Text>
        {user.last_message_preview ? (
          <Text style={styles.previewText} numberOfLines={1}>
            {user.last_message_preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function MessageBubble({ item }: { item: ChatMessage }) {
  return (
    <View style={[styles.messageBubble, item.is_mine ? styles.messageMine : styles.messageOther]}>
      <Text style={styles.messageAuthor}>{item.sender_name}</Text>
      {item.message ? <Text style={styles.messageText}>{item.message}</Text> : null}
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.messageImage} /> : null}
      <Text style={styles.messageTime}>{formatTime(item.sent_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3EEE7' },
  content: { padding: 20, gap: 16, paddingBottom: 28 },
  hero: {
    backgroundColor: '#FFFDF9',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E4D8CA',
    gap: 8,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    color: '#F3F3F3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  title: { color: '#2F241B', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#6F6152', fontSize: 15, lineHeight: 22 },
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: '#2F241B', fontSize: 18, fontWeight: '900' },
  mutedText: { color: '#7A6A58', fontSize: 12, fontWeight: '700' },
  contactsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusSwitchWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { color: '#8A7967', fontSize: 12, fontWeight: '900' },
  switchLabelActive: { color: '#2F241B' },
  contactList: { gap: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F6F1EA',
    borderWidth: 1,
    borderColor: '#E1D5C7',
    padding: 12,
    gap: 10,
  },
  contactRowSelected: { backgroundColor: '#EDE3D3', borderColor: '#C9B38F' },
  statusDot: { width: 10, height: 10, borderRadius: 999 },
  statusDotOnline: { backgroundColor: '#486556' },
  statusDotOffline: { backgroundColor: '#B8B0A5' },
  contactInfo: { flex: 1, gap: 3 },
  contactTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactName: { flex: 1, color: '#2F241B', fontSize: 15, fontWeight: '900' },
  contactMeta: { color: '#6F6152', fontSize: 12, fontWeight: '800' },
  previewText: { color: '#8A7967', fontSize: 12 },
  unreadBadge: {
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: '#486556',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: 'center',
  },
  conversationCard: {
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    overflow: 'hidden',
  },
  conversationHeader: { padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: '#E9DED1' },
  messages: { padding: 14, gap: 10, minHeight: 180 },
  messageBubble: { maxWidth: '88%', borderRadius: 18, padding: 12, gap: 6 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#E7EDF1' },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#F4F0EA' },
  messageAuthor: { color: '#6F6152', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  messageText: { color: '#2F241B', fontSize: 15, lineHeight: 21 },
  messageImage: { width: 220, height: 180, borderRadius: 14, backgroundColor: '#E1D5C7' },
  messageTime: { alignSelf: 'flex-end', color: '#7A6A58', fontSize: 11, fontWeight: '700' },
  photoPreview: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#F4F0EA',
    borderWidth: 1,
    borderColor: '#E1D5C7',
    padding: 10,
    gap: 8,
  },
  photoPreviewImage: { width: '100%', height: 160, borderRadius: 14 },
  removePhotoButton: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#6B3F3F', paddingHorizontal: 12, paddingVertical: 8 },
  removePhotoText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  errorBox: { marginHorizontal: 14, marginBottom: 12, borderRadius: 16, backgroundColor: '#F7E7E4', padding: 12 },
  errorText: { color: '#713D35', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  debugBox: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#EEF3F6',
    borderWidth: 1,
    borderColor: '#C8D7DF',
    padding: 12,
    gap: 4,
  },
  debugTitle: { color: '#263B4C', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  debugText: { color: '#425868', fontSize: 12, lineHeight: 17 },
  composer: { borderTopWidth: 1, borderTopColor: '#E9DED1', padding: 12, gap: 10 },
  cameraButton: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#7A6848',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cameraButtonText: { color: '#FFF8E8', fontSize: 13, fontWeight: '900' },
  input: {
    minHeight: 74,
    maxHeight: 130,
    borderRadius: 18,
    backgroundColor: '#F8F4EE',
    borderWidth: 1,
    borderColor: '#DED2C4',
    color: '#2F241B',
    fontSize: 15,
    padding: 14,
    textAlignVertical: 'top',
  },
  sendButton: { borderRadius: 16, backgroundColor: '#111111', paddingVertical: 14, alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  feedbackCard: {
    borderRadius: 22,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E4D8CA',
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  feedbackText: { color: '#6A5B4C', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
