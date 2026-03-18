import React from 'react';
import { toast, ToastContent, ToastOptions } from 'react-toastify';

interface CustomToastProps {
  visible: boolean;
  id: string;
}

interface SponsorshipToastProps extends CustomToastProps {
  sponsorName: string;
  onView: () => void;
  
}

interface SponsorStatusToastProps extends CustomToastProps {
  status: string;
  onAction: () => void;
}

const SponsorshipRequestToast: React.FC<SponsorshipToastProps> = ({ sponsorName, onView }) => (
  <div className="max-w-md w-full bg-black/90 backdrop-blur-sm shadow-lg rounded-lg pointer-events-auto ring-1 ring-fireside-orange/30 mb-2 border border-fireside-orange/30 relative overflow-hidden">
    <div className="flex">
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="h-10 w-10 rounded-full bg-fireside-orange/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-fireside-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-fireside-orange">
              New Sponsorship Request
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {sponsorName} has submitted a new sponsorship request for this room.
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-fireside-orange/30">
        <button
          onClick={onView}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-fireside-orange hover:text-fireside-orange/70 focus:outline-none"
        >
          View
        </button>
      </div>
    </div>
  </div>
);

const SponsorStatusToast: React.FC<SponsorStatusToastProps> = ({ status, onAction }) => (
  <div className="max-w-md w-full bg-black/80 shadow-lg rounded-lg pointer-events-auto ring-1 ring-fireside-orange/30 mb-2 border border-fireside-orange/30 relative overflow-hidden">
    <div className="flex">
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className={`text-sm font-medium ${status === "approved" ? "text-green-500" : "text-fireside-red"}`}>
              Sponsorship {status}
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {status === "approved" ? "Proceed to pay by clicking here or on Sponsor Fireside button." : ""}
            </p>
          </div>
        </div>
      </div>
      <div className={`flex border-l ${status === "approved" ? "border-green-500/30" : "border-fireside-red/30"}`}>
        <button
          onClick={onAction}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-green-500 hover:text-green-400 focus:outline-none"
        >
          {status === "approved" ? "Go Live!" : "Got it"}
        </button>
      </div>
    </div>
  </div>
);

export const showSponsorshipRequestToast = (sponsorName: string, onView: () => void) => {
  toast(<SponsorshipRequestToast sponsorName={sponsorName} onView={onView} visible={true} id="" />, {
    position: "top-center",
    autoClose: false,
    hideProgressBar: true,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: false,
    className: "custom-toast",
    style: { background: 'transparent', boxShadow: 'none' }
  });
};

export const showSponsorStatusToast = (status: string, onAction: () => void) => {
  toast(<SponsorStatusToast status={status} onAction={onAction} visible={true} id="" />, {
    position: "top-center",
    autoClose: false,
    hideProgressBar: true,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: false,
    className: "custom-toast",
    style: { background: 'transparent', boxShadow: 'none' }
  });
};
