import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useStyles, typography, type ThemeColors } from "../../../../theme";
import { useApiary } from "../../../../hooks/useApiaries";
import { useShares, useRemoveShare, useCreateShare } from "../../../../hooks/useShares";
import { useResourcePermission } from "../../../../hooks/usePermissions";
import { CollaboratorRow } from "../../../../components/sharing/CollaboratorRow";
import { FormInput } from "../../../../components/FormInput";
import { FormActionButton } from "../../../../components/FormActionButton";
import { RolePicker } from "../../../../components/sharing/RolePicker";
import { EmptyState } from "../../../../components/EmptyState";
import type { Share, ShareRole } from "../../../../services/api.types";

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1, backgroundColor: c.bgPrimary },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: typography.families.displaySemiBold,
    color: c.textPrimary,
    marginBottom: 12,
  },
  inviteSection: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  separator: {
    height: 1,
    backgroundColor: c.border,
    marginHorizontal: 16,
    marginVertical: 8,
  },
});

export default function ShareManagementScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: "apiary" | "hive" }>();
  const router = useRouter();
  const styles = useStyles(createStyles);

  const params = type === "hive" ? { hiveId: id } : { apiaryId: id };
  const { data: shares = [], isLoading } = useShares(params);
  const { data: apiary } = useApiary(type === "apiary" ? id! : "");
  const removeMutation = useRemoveShare();
  const createMutation = useCreateShare();

  const { canManageSharing } = useResourcePermission(apiary?.myRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const activeShares = shares.filter(
    (s) => s.status === "accepted" || s.status === "pending",
  );

  const handleRemove = (shareId: string) => {
    Alert.alert("Remove Access", "Remove this collaborator's access?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeMutation.mutate(shareId),
      },
    ]);
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    const data = type === "hive"
      ? { email: email.trim(), hiveId: id, role }
      : { email: email.trim(), apiaryId: id, role };
    createMutation.mutate(data, {
      onSuccess: () => {
        setEmail("");
        Alert.alert("Invited", `Invitation sent to ${email.trim()}`);
      },
      onError: (err) => {
        Alert.alert("Error", (err as Error).message || "Failed to send invitation");
      },
    });
  };

  const renderItem = ({ item }: { item: Share }) => (
    <CollaboratorRow
      share={item}
      canManage={canManageSharing}
      onRemove={handleRemove}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={activeShares}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {canManageSharing ? (
              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>Invite Collaborator</Text>
                <FormInput
                  label="Email"
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <RolePicker role={role} onChange={setRole} />
                <FormActionButton
                  label="Send Invitation"
                  onPress={handleInvite}
                  disabled={createMutation.isPending}
                />
              </View>
            ) : null}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Collaborators</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No collaborators yet"
              subtitle="Invite someone to share this resource"
            />
          ) : null
        }
      />
    </View>
  );
}
