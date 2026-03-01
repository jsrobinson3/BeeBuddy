import { useState, useCallback } from "react";
import { Alert, FlatList, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MessageCircle, Plus, Trash2 } from "lucide-react-native";

import { useConversations, useDeleteConversation } from "../../../hooks/useChat";
import { EmptyState } from "../../../components/EmptyState";
import { ErrorDisplay } from "../../../components/ErrorDisplay";
import { HexIcon } from "../../../components/HexIcon";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { ResponsiveContainer } from "../../../components/ResponsiveContainer";
import type { Conversation } from "../../../services/api";
import {
  useStyles,
  useTheme,
  typography,
  spacing,
  radii,
  shadows,
  webPointer,
  type ThemeColors,
} from "../../../theme";

// ── Styles ────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  list: { padding: spacing.md },
  card: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: c.bgElevated,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.card,
    shadowColor: c.shadowColor,
    ...webPointer,
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontFamily: typography.families.displaySemiBold,
    fontSize: 15,
    color: c.textPrimary,
    numberOfLines: 1,
  },
  cardTime: {
    fontFamily: typography.families.body,
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.xs,
    borderRadius: radii.md,
  },
  fab: { position: "absolute" as const, right: 20, bottom: 20, ...webPointer },
});

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CardIcon() {
  const { colors } = useTheme();
  return (
    <HexIcon size={36} filled fillColor={colors.primaryFill}>
      <MessageCircle size={18} color={colors.textOnPrimary} />
    </HexIcon>
  );
}

function CardBody({ title, updatedAt }: { title: string | null; updatedAt: string }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title || "New conversation"}
      </Text>
      <Text style={styles.cardTime}>{formatRelativeTime(updatedAt)}</Text>
    </View>
  );
}

function ConversationCard(
  { item, onPress, onDelete }: { item: Conversation; onPress: () => void; onDelete: () => void },
) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <CardIcon />
      <CardBody title={item.title} updatedAt={item.updatedAt} />
      <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
        <Trash2 size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function ChatEmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <EmptyState
      title="No conversations yet"
      subtitle="Start a new chat to get AI-powered beekeeping advice"
      actionLabel="New Chat"
      onAction={onNewChat}
    />
  );
}

function ConversationList({ conversations, onSelect, onDelete, onNewChat, refreshing, onRefresh }: {
  conversations: Conversation[] | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const styles = useStyles(createStyles);
  const renderItem = ({ item }: { item: Conversation }) => (
    <ConversationCard
      item={item}
      onPress={() => onSelect(item.id)}
      onDelete={() => onDelete(item.id)}
    />
  );
  return (
    <FlatList
      data={conversations}
      contentContainerStyle={styles.list}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={<ChatEmptyState onNewChat={onNewChat} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

function NewChatFab({ onPress }: { onPress: () => void }) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <HexIcon size={52} filled fillColor={colors.primaryFill}>
        <Plus size={24} color={colors.textOnPrimary} />
      </HexIcon>
    </Pressable>
  );
}

function ChatContent({ conversations, onSelect, onDelete, onNewChat, refreshing, onRefresh }: {
  conversations: Conversation[] | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ResponsiveContainer fill>
      <ConversationList
        conversations={conversations}
        onSelect={onSelect}
        onDelete={onDelete}
        onNewChat={onNewChat}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </ResponsiveContainer>
  );
}

export default function ChatListScreen() {
  const router = useRouter();
  const styles = useStyles(createStyles);
  const { data: conversations, isLoading, error, refetch } = useConversations();
  const deleteMutation = useDeleteConversation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay message="Failed to load conversations" onRetry={refetch} />;

  const goToChat = (id: string) => router.push(`/chat/${id}`);
  const goToNew = () => router.push("/chat/new");

  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this conversation?")) {
        deleteMutation.mutate(id);
      }
      return;
    }
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ChatContent
        conversations={conversations}
        onSelect={goToChat}
        onDelete={confirmDelete}
        onNewChat={goToNew}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
      <NewChatFab onPress={goToNew} />
    </View>
  );
}
