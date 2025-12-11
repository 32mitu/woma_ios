import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActionSheetIOS, Platform, TextInput, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { RenderTextWithHashtags, timeAgo } from '../utils/timelineUtils';
import { CommentSection } from './CommentSection';
import { useRouter } from 'expo-router';
import { useAuth } from '../../auth/useAuth';
import { useSafety } from '../../../hooks/useSafety';

// 画面幅を取得（画像のサイズ設定に使用）
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PostProps = {
  post: {
    id: string;
    user: string;
    userId?: string;
    userAvatar?: string | null;
    text: string;
    imageUrls?: string[]; // ★変更: 複数画像に対応
    likes: number;
    comments?: number;
    timestamp: any;
    activities?: { name: string; duration: number; mets?: number }[]; 
  };
};

export const Post = ({ post }: PostProps) => {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { reportContent, blockUser } = useSafety();

  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // ★追加: カルーセル用の現在のページ管理
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ... (省略: handleLike, handleDelete, handleMenu などの既存関数はそのまま) ...
  const handleLike = async () => { /* ...既存のコード... */ setLiked(!liked); };
  const handleDelete = async () => { /* ...既存のコード... */ };
  const handleMenu = () => { /* ...既存のコード... */ };

  // ★追加: スクロール時の現在ページ判定
  const onScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    setCurrentImageIndex(roundIndex);
  };

  return (
    <View style={styles.card}>
      {/* ヘッダー (ユーザー情報) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => post.userId && router.push(`/public/${post.userId}`)}>
            {post.userAvatar ? (
              <Image source={{ uri: post.userAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>{post.user}</Text>
            <Text style={styles.date}>{timeAgo(post.timestamp)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleMenu} style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* 投稿本文 */}
      <View style={styles.content}>
        <View style={styles.textArea}>
          <RenderTextWithHashtags text={post.text} />
        </View>

        {/* 運動記録バッジ */}
        {post.activities && post.activities.length > 0 && (
          <View style={styles.activitiesContainer}>
            {post.activities.map((act, index) => (
              <View key={index} style={styles.activityBadge}>
                <Ionicons name="fitness-outline" size={14} color="#3B82F6" style={{ marginRight: 4 }} />
                <Text style={styles.activityText}>
                  {act.name} {act.duration}分
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ★画像カルーセル表示 (ここを大幅変更) */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <View style={styles.imageContainer}>
          <FlatList
            data={post.imageUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16} // スクロールイベントの頻度調整
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Image 
                source={{ uri: item }} 
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }} // 正方形
                resizeMode="cover"
              />
            )}
          />
          
          {/* ドットインジケーター (画像が2枚以上の時だけ表示) */}
          {post.imageUrls.length > 1 && (
            <View style={styles.paginationContainer}>
              {post.imageUrls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentImageIndex ? styles.paginationDotActive : styles.paginationDotInactive
                  ]}
                />
              ))}
              {/* 右上の枚数表示 (1/3 みたいに表示したい場合) */}
              <View style={styles.pageCountBadge}>
                <Text style={styles.pageCountText}>{currentImageIndex + 1}/{post.imageUrls.length}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* フッター (いいね・コメント) */}
      <View style={styles.footer}>
        {/* ... (省略: 既存のボタン類はそのまま) ... */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
           <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? "#EF4444" : "#333"} />
           <Text style={[styles.actionText, liked && { color: '#EF4444' }]}>{post.likes + (liked ? 1 : 0)}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComments(!showComments)}>
          <Ionicons name="chatbubble-outline" size={22} color="#333" />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>
      </View>

      {/* コメントセクション */}
      {showComments && <CommentSection postId={post.id} />}
    </View>
  );
};

const styles = StyleSheet.create({
  // ... 既存のスタイルは維持しつつ、以下を追加/修正 ...
  card: {
    backgroundColor: '#fff',
    marginBottom: 10,
    // padding: 12, を削除 (画像を端まで表示するため)
    paddingTop: 12, // ヘッダー用の余白
    paddingBottom: 12, // フッター用の余白
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8,
    paddingHorizontal: 12, // カード全体のpaddingを消したのでここで追加
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor:'#ccc', justifyContent:'center', alignItems:'center' },
  userName: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  date: { fontSize: 12, color: '#888' },
  menuButton: { padding: 4 },
  
  content: {
    paddingHorizontal: 12, // 本文にもpadding追加
    marginBottom: 8,
  },
  textArea: { marginBottom: 8 }, 
  
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  activityText: { fontSize: 13, color: '#3B82F6' },

  // ★画像カルーセル用スタイル
  imageContainer: {
    width: '100%',
    height: SCREEN_WIDTH, // 正方形表示
    position: 'relative',
    marginBottom: 12,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: '#3B82F6', // アクティブ時は青
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paginationDotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // 非アクティブ時は半透明の白
  },
  pageCountBadge: {
    position: 'absolute',
    top: -SCREEN_WIDTH + 20, // 画像の上部に配置
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  footer: { 
    flexDirection: 'row', 
    paddingTop: 8, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 12, // フッターにもpadding追加
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
  actionText: { marginLeft: 6, fontSize: 14, color: '#555' },
});