import BoardApp from '@/components/BoardApp';
import {boardOrDefault} from '@/lib/boards';
export default async function Page({params}:{params:Promise<{board:string}>}){
 const {board}=await params;
 return <BoardApp board={boardOrDefault(board)}/>;
}
