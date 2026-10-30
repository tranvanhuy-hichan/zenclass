"use client";
import { useState } from "react";

export type BranchOpt = { id: string; name: string };
export type RoomOpt = { id: string; name: string; branchId: string | null; capacity?: number };

/** Chọn cơ sở trước, rồi chọn phòng thuộc cơ sở đó. */
export function BranchRoomFields({ branches, rooms, branchId = "", roomId = "", cls, labelCls, busy = {}, onRoom }: { branches: BranchOpt[]; rooms: RoomOpt[]; branchId?: string; roomId?: string; cls: string; labelCls: string; busy?: Record<string, string>; onRoom?: (id: string) => void }) {
  const [b, setB] = useState(branchId || (roomId ? rooms.find((r) => r.id === roomId)?.branchId ?? "" : ""));
  const [r, setR] = useState(roomId);
  const list = rooms.filter((x) => x.branchId === b);
  return (
    <>
      <label className={labelCls}>Cơ sở *
        <select name="branchId" value={b} onChange={(e) => { setB(e.target.value); setR(""); onRoom?.(""); }} className={cls} required>
          <option value="">-- chọn cơ sở --</option>{branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label className={labelCls}>Phòng học
        <select name="roomId" value={r} onChange={(e) => { setR(e.target.value); onRoom?.(e.target.value); }} className={cls} disabled={!b}>
          <option value="">{b ? "-- chưa xếp --" : "Chọn cơ sở trước"}</option>
          {list.map((x) => <option key={x.id} value={x.id} disabled={!!busy[x.id] && x.id !== r}>{x.name}{x.capacity ? ` (${x.capacity} chỗ)` : ""}{busy[x.id] ? ` — BẬN: ${busy[x.id]}` : ""}</option>)}
        </select>
      </label>
    </>
  );
}
