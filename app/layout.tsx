import type {ReactNode} from 'react';
import './globals.css';
export const metadata={title:'Live Ranking Board',description:'OBS live ranking board'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ko"><body>{children}</body></html>}
