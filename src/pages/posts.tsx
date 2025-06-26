import { PostForm } from '../components/posts/post-form';
import { PostList } from '../components/feed/post-list';

export function PostsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Posts</h1>
      <PostForm />
      <PostList />
    </div>
  );
}