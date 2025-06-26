import { useState } from 'react';
import { GroupList } from '../components/groups/group-list';
import { CreateGroup } from '../components/groups/create-group';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../store/auth';

export function GroupsPage() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const { user } = useAuthStore();
  const isClassLeader = user?.role === 'class_leader';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Student Groups</h1>
        {isClassLeader && (
          <Button onClick={() => setShowCreateGroup(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Create Group
          </Button>
        )}
      </div>

      <GroupList setShowCreateGroup={setShowCreateGroup} />

      {showCreateGroup && (
        <CreateGroup onClose={() => setShowCreateGroup(false)} />
      )}
    </div>
  );
}