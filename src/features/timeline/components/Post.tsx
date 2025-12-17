import React, { useState, useEffect } from 'react';
import { 
  View, Text, Image, TouchableOpacity, StyleSheet, Alert, 
  Dimensions, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, increment, deleteDoc, getDoc } from 'firebase/firestore'; // ★getDoc追加
import { db } from '../../../../firebaseConfig';
import { RenderTextWithHashtags, timeAgo } from '../utils/timelineUtils';
import { CommentSection } from './CommentSection';
import { useRouter } from 'expo-router';
import { useAuth } from '../../auth/useAuth';
import { useSafety } from '../../../hooks/useSafety';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PostProps = {
  post: {
    id: string;
    userId?: string;
    text: string;
    imageUrls?: string[];
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
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [activePage, setActivePage] = useState(0);

  // ★追加: ユーザー情報のローカルステート
  const [authorName, setAuthorName] = useState("読み込み中...");
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);

  // ★追加: ユーザーIDをもとに、usersコレクションから最新情報を取得
  useEffect(() => {
    const fetchAuthorProfile = async () => {
      if (!post.userId) {
        setAuthorName("不明なユーザー");
        return;
      }
      
      try {
        // プロフィール機能で使われている users コレクションを参照
        const userDocRef = doc(db, 'users', post.userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          // DM/プロフィールと同じフィールド名を参照
          setAuthorName(data.username || data.displayName || "名無し");
          setAuthorAvatar(data.profileImageUrl || data.photoURL || null);
        } else {
          setAuthorName("退会済みユーザー");
        }
      } catch (error) {
        console.error("User fetch error:", error);
        setAuthorName("エラー");
      }
    };

    fetchAuthorProfile();
  }, [post.userId]);

  const handlePressProfile = () => {
    if (post.userId) {
      router.push(`/public/${post.userId}` as any);
    }
  };

  const handleLike = async () => {
    if (!userProfile) return;
    const postRef = doc(db, "timeline", post.id);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      if (newLiked) {
        await updateDoc(postRef, { likes: increment(1) });
      } else {
        await updateDoc(postRef, { likes: increment(-1) });
      }
    } catch (error) {
      setLiked(!newLiked);
      setLikeCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  const handleOptions = () => {
    if (!userProfile) return;
    const isMyPost = userProfile.uid === post.userId;
    const options = isMyPost 
      ? [{ text: '削除する', style: 'destructive', onPress: handleDelete }] 
      : [
          { text: '通報する', style: 'destructive', onPress: () => handleReport() },
          { text: 'ブロックする', style: 'destructive', onPress: () => handleBlock() }
        ];

    Alert.alert('メニュー', '', [...options as any, { text: 'キャンセル', style: 'cancel' }]);
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "timeline", post.id));
    } catch (e) {
      Alert.alert("エラー", "削除に失敗しました");
    }
  };

  const handleReport = async () => {
    await reportContent(post.id, 'post', '不適切な投稿');
    Alert.alert("報告", "運営に報告しました。");
  };

  const handleBlock = async () => {
    if (post.userId) {
      await blockUser(post.userId);
      Alert.alert("ブロック", "このユーザーをブロックしました。");
    }
  };

  const handleScroll = (event: any) => {
    const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== activePage) {
      setActivePage(slide);
    }
  };

  return (
    <View style={styles.card}>
      {/* ヘッダー: 取得した最新のプロフィール情報を表示 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePressProfile} style={styles.userInfo}>
          {authorAvatar ? (
            <Image source={{ uri: authorAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color="#9ca3af" />
            </View>
          )}
          <View>
            <Text style={styles.username}>{authorName}</Text>
            <Text style={styles.date}>{timeAgo(post.timestamp)}</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleOptions} style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* アクティビティタグ */}
      {post.activities && post.activities.length > 0 && (
        <View style={styles.activityContainer}>
          {post.activities.map((act, index) => (
            <View key={index} style={styles.activityBadge}>
              <Text style={styles.activityText}>🏃 {act.name} {act.duration}分</Text>
            </View>
          ))}
        </View>
      )}

      {/* 本文 */}
      <View style={styles.content}>
        <RenderTextWithHashtags text={post.text} />
      </View>

      {/* 画像カルーセル */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <View style={styles.imageWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.imageScroll}
          >
            {post.imageUrls.map((url, index) => (
              <Image 
                key={index} 
                source={{ uri: url }} 
                style={styles.postImage} 
                resizeMode="cover" 
              />
            ))}
          </ScrollView>
          
          {post.imageUrls.length > 1 && (
            <View style={styles.pagination}>
              {post.imageUrls.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.dot, 
                    index === activePage ? styles.activeDot : styles.inactiveDot
                  ]} 
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* フッター */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons 
            name={liked ? "heart" : "heart-outline"} 
            size={24} 
            color={liked ? "#ef4444" : "#4b5563"} 
          />
          <Text style={[styles.actionText, liked && { color: '#ef4444' }]}>
            {likeCount > 0 ? likeCount : 'えらい！'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#4b5563" />
          <Text style={styles.actionText}>
            {post.comments && post.comments > 0 ? post.comments : 'コメント'}
          </Text>
        </TouchableOpacity>
      </View>

      {showComments && (
        <CommentSection postId={post.id} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    marginBottom: 12,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f3f4f6',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#1f2937',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  activityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  activityBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  activityText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, 
    marginBottom: 12,
    position: 'relative',
  },
  imageScroll: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#f3f4f6',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 3,
  },
  activeDot: {
    width: 20,
    height: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  inactiveDot: {
    width: 6,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
});