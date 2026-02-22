import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useInspectionPhotos, useUploadPhoto, useDeletePhoto } from "../hooks/usePhotos";
import { getPhotoFileUrl } from "../services/api";
import type { InspectionPhoto } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useStyles, typography, useTheme, type ThemeColors } from "../theme";

const createStyles = (c: ThemeColors) => ({
  container: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: c.selectedBg,
    borderWidth: 1,
    borderColor: c.honey,
    alignItems: "center" as const,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: typography.families.bodySemiBold,
    color: c.honey,
  },
  uploadingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 8,
  },
  uploadingText: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.honey,
  },
  loader: {
    marginVertical: 8,
  },
  thumbnailScroll: {
    marginTop: 4,
  },
  thumbnailScrollContent: {
    gap: 8,
  },
  thumbnail: {
    width: 80,
    alignItems: "center" as const,
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  captionText: {
    fontSize: 11,
    fontFamily: typography.families.body,
    color: c.textSecondary,
    marginTop: 2,
    textAlign: "center" as const,
  },
  noPhotos: {
    fontSize: 13,
    fontFamily: typography.families.body,
    color: c.textMuted,
    fontStyle: "italic" as const,
    marginTop: 4,
  },
});

function Thumbnail({
  photo,
  token,
  onLongPress,
  styles,
}: {
  photo: InspectionPhoto;
  token: string | null;
  onLongPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onLongPress={onLongPress} style={styles.thumbnail}>
      <Image
        source={{ uri: getPhotoFileUrl(photo.id, token ?? undefined) }}
        style={styles.thumbnailImage}
      />
      {photo.caption && (
        <Text style={styles.captionText} numberOfLines={1}>
          {photo.caption}
        </Text>
      )}
    </Pressable>
  );
}

interface PhotoPickerProps {
  inspectionId: string;
}

export function PhotoPicker({ inspectionId }: PhotoPickerProps) {
  const token = useAuthStore((s) => s.token);
  const { data: photos, isLoading } = useInspectionPhotos(inspectionId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const [uploading, setUploading] = useState(false);
  const styles = useStyles(createStyles);
  const { colors } = useTheme();

  async function pickAndUpload(
    launcher: () => Promise<ImagePicker.ImagePickerResult>,
  ) {
    const result = await launcher();
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];

    setUploading(true);
    try {
      await uploadPhoto.mutateAsync({
        inspectionId,
        fileUri: asset.uri,
      });
    } catch (err: any) {
      Alert.alert("Upload failed", err.message ?? "Could not upload photo");
    } finally {
      setUploading(false);
    }
  }

  function handleCamera() {
    pickAndUpload(() =>
      ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      }),
    );
  }

  function handleGallery() {
    pickAndUpload(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      }),
    );
  }

  function handleDelete(photo: InspectionPhoto) {
    Alert.alert("Delete Photo", "Remove this photo from the inspection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deletePhoto.mutate({
            inspectionId,
            photoId: photo.id,
          }),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <Pressable
          style={styles.actionButton}
          onPress={handleCamera}
          disabled={uploading}
        >
          <Text style={styles.actionButtonText}>Camera</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={handleGallery}
          disabled={uploading}
        >
          <Text style={styles.actionButtonText}>Gallery</Text>
        </Pressable>
      </View>

      {uploading && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.honey} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      {isLoading && !photos && (
        <ActivityIndicator
          size="small"
          color={colors.honey}
          style={styles.loader}
        />
      )}

      {photos && photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbnailScroll}
          contentContainerStyle={styles.thumbnailScrollContent}
        >
          {photos.map((photo) => (
            <Thumbnail
              key={photo.id}
              photo={photo}
              token={token}
              onLongPress={() => handleDelete(photo)}
              styles={styles}
            />
          ))}
        </ScrollView>
      )}

      {photos && photos.length === 0 && !uploading && (
        <Text style={styles.noPhotos}>No photos yet</Text>
      )}
    </View>
  );
}
