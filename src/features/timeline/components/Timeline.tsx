import React from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Post } from './Post';
import { useTimeline } from '../hooks/useTimeline';

type Props = {
  groupId?: string;
};

export const Timeline = ({ groupId }: Props) => {
  const { posts, loading } = useTimeline(groupId);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>
          {groupId ? "まだグループの投稿がありません。" : "まだ投稿がありません。"}
        </Text>
        <Text style={styles.emptyText}>最初の1人になりませんか？</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        scrollEnabled={!groupId}
        renderItem={({ item }) => (
          <Post 
            post={{
              id: item.id,
              user: item.username || "名無し",
              userAvatar: item.profileImageUrl || item.userIcon || null,
              text: item.text || item.comment || "",
              // ★変更: 1枚だけではなく、全画像を配列として渡す
              imageUrls: item.imageUrls || (item.imageUrl ? [item.imageUrl] : []),
              
              likes: item.likes || 0,
              comments: item.comments || 0,
              timestamp: item.createdAt,
              activities: item.activities || [], 
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { paddingBottom: 20 },
  emptyText: { color: '#6B7280', fontSize: 16, marginBottom: 8 },
});