import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { EditProfile } from '../components/profile/edit-profile';
import { ProfileView } from '../components/profile/profile-view';
import { HobbySelector } from '../components/profile/hobby-selector';
import { StudentReportForm } from '../components/profile/student-report-form';
import { useAuthStore } from '../store/auth';
import { SavedPosts } from '../components/profile/saved-posts';

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'hobbies' | 'report' | 'saved'>('profile');
  const { id } = useParams();
  const { user } = useAuthStore();

  // If viewing another user's profile or accessing via URL with ID
  if (id && id !== user?.id) {
    return <ProfileView />;
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          className={`rounded-lg px-4 py-2 ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${
            activeTab === 'hobbies'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setActiveTab('hobbies')}
        >
          Hobbies
        </button>
        <button
          className={`rounded-lg px-4 py-2 ${
            activeTab === 'saved'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setActiveTab('saved')}
        >
          Saved
        </button>
        {user?.role === 'student' && (
          <button
            className={`rounded-lg px-4 py-2 ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setActiveTab('report')}
          >
            Report Incident
          </button>
        )}
      </div>

      {activeTab === 'profile' && <EditProfile />}
      {activeTab === 'hobbies' && <HobbySelector />}
      {activeTab === 'saved' && <SavedPosts />}
      {activeTab === 'report' && user?.role === 'student' && (
        <StudentReportForm onClose={() => setActiveTab('profile')} />
      )}
    </div>
  );
}