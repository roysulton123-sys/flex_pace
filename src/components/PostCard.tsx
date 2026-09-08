import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Share, 
  Modal, 
  TextInput, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export interface PostComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name?: string;
    avatar_url?: string;
  };
}

export interface PostData {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  profiles?: {
    name?: string;
    avatar_url?: string;
  };
  likes?: { user_id: string }[];
  comments?: PostComment[];
}

interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onPostUpdated?: () => void;
}

export default function PostCard({ post, currentUserId, onPostUpdated }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [isLiking, setIsLiking] = useState(false);

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    // Cek apakah user saat ini sudah me-like postingan ini
    if (currentUserId && post.likes) {
      const isUserLiked = post.likes.some(l => l.user_id === currentUserId);
      setLiked(isUserLiked);
    }
    setLikeCount(post.likes?.length || 0);
  }, [post, currentUserId]);

  const handleToggleLike = async () => {
    if (!currentUserId) {
      Alert.alert("Perhatian", "Silakan login untuk menyukai postingan ini.");
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    // Optimistic UI update
    const previousLiked = liked;
    const previousCount = likeCount;
    setLiked(!previousLiked);
    setLikeCount(previousLiked ? previousCount - 1 : previousCount + 1);

    try {
      if (previousLiked) {
        // Hapus Like
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);
        if (error) throw error;
      } else {
        // Tambah Like
        const { error } = await supabase
          .from('likes')
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });
        if (error) throw error;
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      console.error("Error toggling like:", err.message);
    } finally {
      setIsLiking(false);
    }
  };

  const openComments = async () => {
    setCommentModalVisible(true);
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles (
            name,
            avatar_url
          )
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments((data as any) || []);
    } catch (err: any) {
      console.error("Error fetching comments:", err.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    if (!currentUserId) {
      Alert.alert("Perhatian", "Silakan login untuk berkomentar.");
      return;
    }

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: commentText.trim(),
        })
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles (
            name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setComments(prev => [...prev, data as any]);
        setCommentText('');
        if (onPostUpdated) onPostUpdated();
      }
    } catch (err: any) {
      Alert.alert("Gagal Mengirim Komentar", err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      'Hapus Komentar?',
      'Apakah Anda yakin ingin menghapus komentar ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('comments').delete().eq('id', commentId);
              if (error) throw error;
              setComments(prev => prev.filter(c => c.id !== commentId));
              if (onPostUpdated) onPostUpdated();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus Komentar', err.message);
            }
          }
        }
      ]
    );
  };

  const handleMoreOptions = () => {
    const isOwner = currentUserId === post.user_id;
    if (isOwner) {
      Alert.alert(
        'Kelola Postingan',
        'Pilih tindakan untuk postingan Anda:',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Bagikan Postingan', onPress: handleShare },
          { 
            text: 'Hapus Postingan', 
            style: 'destructive',
            onPress: confirmDeletePost
          }
        ]
      );
    } else {
      Alert.alert(
        'Opsi Postingan',
        'Pilih tindakan:',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Bagikan Postingan', onPress: handleShare },
          { 
            text: 'Laporkan Postingan', 
            style: 'destructive',
            onPress: () => Alert.alert('Laporan Terkirim', 'Terima kasih, laporan Anda telah diterima tim moderasi.')
          }
        ]
      );
    }
  };

  const confirmDeletePost = () => {
    Alert.alert(
      'Hapus Postingan?',
      'Postingan foto ini akan dihapus secara permanen dari feed Flex Pace.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('likes').delete().eq('post_id', post.id);
              await supabase.from('comments').delete().eq('post_id', post.id);
              const { error } = await supabase.from('posts').delete().eq('id', post.id);
              if (error) throw error;
              Alert.alert('Sukses', 'Postingan berhasil dihapus.');
              if (onPostUpdated) onPostUpdated();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.message);
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    try {
      const userName = post.profiles?.name || 'Seorang Atlet Flex Pace';
      await Share.share({
        message: `Lihat postingan dari ${userName} di aplikasi Flex Pace:\n"${post.caption}"\n${post.image_url || ''}`,
        title: 'Flex Pace Post',
      });
    } catch (err: any) {
      console.log("Error sharing:", err.message);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes}m lalu`;
    if (diffHours < 24) return `${diffHours}j lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const userName = post.profiles?.name || 'Flex Athlete';
  const userAvatar = post.profiles?.avatar_url || 'https://via.placeholder.com/150';

  return (
    <View style={styles.card}>
      {/* Header: Foto Profil, Nama, Waktu */}
      <View style={styles.header}>
        <Image source={{ uri: userAvatar }} style={styles.avatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.timestamp}>{formatDate(post.created_at)}</Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={handleMoreOptions} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#999999" />
        </TouchableOpacity>
      </View>

      {/* Gambar Postingan */}
      {post.image_url ? (
        <Image 
          source={{ uri: post.image_url }} 
          style={styles.postImage} 
          resizeMode="cover"
        />
      ) : null}

      {/* Action Bar: Like, Komen, Share */}
      <View style={styles.actionsBar}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike}>
            <Ionicons 
              name={liked ? "heart" : "heart-outline"} 
              size={26} 
              color={liked ? "#FF3B30" : "#ffffff"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={openComments}>
            <Ionicons name="chatbubble-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="paper-plane-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="bookmark-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Info Like Count */}
      <View style={styles.statsRow}>
        <Text style={styles.likesText}>
          {likeCount > 0 ? `${likeCount} suka` : 'Jadilah yang pertama menyukai ini'}
        </Text>
      </View>

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUserName}>{userName} </Text>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {/* Komentar Trigger */}
      <TouchableOpacity onPress={openComments} style={styles.viewCommentsBtn}>
        <Text style={styles.viewCommentsText}>
          {post.comments && post.comments.length > 0 
            ? `Lihat semua ${post.comments.length} komentar` 
            : 'Tulis komentar...'}
        </Text>
      </TouchableOpacity>

      {/* MODAL KOMENTAR */}
      <Modal
        visible={commentModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCommentModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCommentModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Komentar</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* List Komentar */}
          {loadingComments ? (
            <View style={styles.commentsLoader}>
              <ActivityIndicator color="#D7FF00" size="large" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={50} color="#444" />
              <Text style={styles.emptyCommentsText}>Belum ada komentar.</Text>
              <Text style={styles.emptyCommentsSub}>Mulai percakapan pertama!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              renderItem={({ item }) => {
                const canDelete = item.user_id === currentUserId || post.user_id === currentUserId;
                return (
                  <View style={styles.commentItem}>
                    <Image 
                      source={{ uri: item.profiles?.avatar_url || 'https://via.placeholder.com/150' }} 
                      style={styles.commentAvatar} 
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentAuthor}>{item.profiles?.name || 'Athlete'}</Text>
                        <Text style={styles.commentText}>{item.content}</Text>
                      </View>
                      <View style={styles.commentMetaRow}>
                        <Text style={styles.commentTime}>{formatDate(item.created_at)}</Text>
                        {canDelete && (
                          <TouchableOpacity 
                            onPress={() => handleDeleteComment(item.id)}
                            style={styles.deleteCommentBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={13} color="#FF453A" style={{ marginRight: 2 }} />
                            <Text style={styles.deleteCommentText}>Hapus</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Input Box Komentar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Tambahkan komentar..."
              placeholderTextColor="#666"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendBtn, 
                { opacity: commentText.trim() && !submittingComment ? 1 : 0.4 }
              ]} 
              onPress={handleSendComment}
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#000000" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#131317',
    marginBottom: 16,
    marginHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E24',
    borderWidth: 1.5,
    borderColor: '#D7FF00',
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  timestamp: {
    color: '#888888',
    fontSize: 11,
    marginTop: 2,
  },
  moreButton: {
    padding: 5,
  },
  postImage: {
    width: '100%',
    height: 360,
    backgroundColor: '#1c1c1e',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    marginRight: 16,
  },
  statsRow: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  likesText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  captionContainer: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  captionText: {
    color: '#e5e5e5',
    fontSize: 14,
    lineHeight: 19,
  },
  captionUserName: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  viewCommentsBtn: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  viewCommentsText: {
    color: '#888888',
    fontSize: 13,
  },

  // MODAL STYLES
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#222222',
  },
  closeBtn: {
    padding: 4,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentsLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCommentsText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptyCommentsSub: {
    color: '#777777',
    fontSize: 13,
    marginTop: 4,
  },
  commentsList: {
    padding: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: '#333333',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  commentAuthor: {
    color: '#D7FF00',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  commentText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  commentTime: {
    color: '#666666',
    fontSize: 11,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 6,
  },
  deleteCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteCommentText: {
    color: '#FF453A',
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#111111',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#333333',
    marginRight: 10,
  },
  sendBtn: {
    backgroundColor: '#D7FF00',
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
