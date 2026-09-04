import ObsBoard from '@/components/ObsBoard';
import {boardOrDefault} from '@/lib/boards';
export default async function Page({params}:{params:Promise<{board:string}>}){
 const {board}=await params;
 return <ObsBoard board={boardOrDefault(board)}/>;
}
