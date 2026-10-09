export type ResourceType = 'UI' | 'Logic' | 'API' | 'Permission';
export interface AgreementItem { id: string; request: string; current: string; difference: string; decision: string; resolved: boolean }
export interface Impact { id: string; name: string; type: ResourceType; reason: string; days: number }
export interface Review { agreementVersion: number; impacts: Impact[]; totalDays: number; durationDays: number; bufferDays: number; markdown: string; formatVersion: string }
export interface WorkRequest { id: string; title: string; description: string; conversation: string; html: string; dueDate: string; version: number; confirmed: boolean; items: AgreementItem[]; review?: Review }
export interface Registration { id: string; registeredAt: string; request: WorkRequest }
