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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          // 投稿データ内のIDフィールドの揺らぎを吸収
          const targetUserId = item.userId || item.uid || item.authorId || item.senderId || item.user?._id;

          return (
            <Post 
              post={{
                id: item.id,
                userId: targetUserId, // ★最重要: ユーザーIDさえあれば復元可能
                
                // 念のため投稿データ内の情報も渡すが、Post側で上書き取得する
                text: item.text || item.comment || "",
                imageUrls: item.imageUrls || (item.imageUrl ? [item.imageUrl] : []),
                
                likes: item.likes || 0,
                comments: item.comments || 0,
                timestamp: item.createdAt,
                activities: item.activities || [], 
              }}
            />
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingBottom: 80, 
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 8,
  },
});