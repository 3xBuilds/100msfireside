// 'use client'

// Device settings component - unused (Agora handles device selection internally)

// interface SelectProps {
//   list?: HMSMediaDevice[];
//   value?: string;
//   onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
//   title: string;
// }

// const Select = ({ list, value, onChange, title }: SelectProps) => {
//   return (
//     <div>
//       <span>{title}:</span>
//       {list?.length ? (
//         <select onChange={onChange} value={value}>
//           {list.map((device) => (
//             <option value={device.deviceId} key={device.deviceId}>
//               {device.label}
//             </option>
//           ))}
//         </select>
//       ) : null}
//     </div>
//   );
// };

// const DeviceSettings = () => {
//   const { allDevices, selectedDeviceIDs, updateDevice } = useDevices();
//   const { videoInput, audioInput, audioOutput } = allDevices;
  
//   return (
//     <div>
//       <h1>Device Settings</h1>
//       <Select
//         title="Microphone"
//         value={selectedDeviceIDs.audioInput}
//         list={audioInput}
//         onChange={(e) =>
//           updateDevice({
//             deviceId: e.target.value,
//             deviceType: DeviceType.audioInput,
//           })
//         }
//       />
//       <Select
//         title="Speaker"
//         value={selectedDeviceIDs.audioOutput}
//         list={audioOutput}
//         onChange={(e) =>
//           updateDevice({
//             deviceId: e.target.value,
//             deviceType: DeviceType.audioOutput,
//           })
//         }
//       />
//     </div>
//   );
// };

// export default DeviceSettings;
