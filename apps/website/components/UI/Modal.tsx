'use client'

import { ReactNode, useEffect } from 'react';
import { MdClose } from 'react-icons/md';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
}

export default function Modal({ 
  isOpen, 
  onClose, 
  children, 
  className,
  backdropClassName,
  showCloseButton = true,
  closeOnBackdropClick = true,
}: ModalProps) {
  
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.documentElement.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);
  
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div 
          key="modal-container"
          className="fixed inset-0 flex items-center justify-center z-[100000] p-4"
          style={{ 
            overflow: 'hidden',
            maxHeight: '100vh',
            maxWidth: '100vw'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div 
            className={cn("absolute inset-0 bg-black/50 backdrop-blur-md", backdropClassName)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdropClick ? onClose : undefined}
          />
          
          {/* Modal content */}
          <motion.div 
            className={cn(
              "bg-black/50 backdrop-blur-lg border-white/30 rounded-lg p-6 border-2 w-full max-w-md max-h-[90vh] overflow-y-auto relative z-10",
              className
            )}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Close button */}
            {showCloseButton && (
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-20"
                aria-label="Close"
              >
                <MdClose size={24} />
              </button>
            )}
            
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}