import { useRef, useEffect, useCallback } from 'react';
import { AtomEditor } from '../atoms/AtomEditor';
import { AtomViewer } from '../atoms/AtomViewer';
import { WikiViewer } from '../wiki/WikiViewer';
import { useUIStore } from '../../stores/ui';
import { useAtomsStore } from '../../stores/atoms';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useKeyboard } from '../../hooks/useKeyboard';

export function RightDrawer() {
  const { drawerState, closeDrawer, openDrawer } = useUIStore();
  const { atoms } = useAtomsStore();
  const drawerRef = useRef<HTMLDivElement>(null);

  const { isOpen, mode, atomId, tagId, tagName } = drawerState;
  const atom = atomId ? atoms.find((a) => a.id === atomId) : null;

  // Close on click outside
  useClickOutside(drawerRef, closeDrawer, isOpen);

  // Close on Escape key
  useKeyboard('Escape', closeDrawer, isOpen);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleEdit = useCallback(() => {
    if (atomId) {
      openDrawer('editor', atomId);
    }
  }, [atomId, openDrawer]);

  const renderContent = () => {
    switch (mode) {
      case 'editor':
        return <AtomEditor atomId={atomId} onClose={closeDrawer} />;
      case 'viewer':
        if (!atom) {
          return (
            <div className="flex items-center justify-center h-full text-[#888888]">
              Atom not found
            </div>
          );
        }
        return <AtomViewer atom={atom} onClose={closeDrawer} onEdit={handleEdit} />;
      case 'wiki':
        if (!tagId || !tagName) {
          return (
            <div className="flex items-center justify-center h-full text-[#888888]">
              No tag selected
            </div>
          );
        }
        return <WikiViewer tagId={tagId} tagName={tagName} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-full max-w-[500px] sm:w-[40vw] sm:min-w-[400px] bg-[#252525] border-l border-[#3d3d3d] shadow-2xl z-50 transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {renderContent()}
      </div>
    </>
  );
}

