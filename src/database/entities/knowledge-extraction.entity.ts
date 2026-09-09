import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { KnowledgeExtractionStatus } from '../enums';
import type { Source } from './source.entity';
import type { Transcription } from './transcription.entity';

@Entity({ name: 'knowledge_extractions' })
export class KnowledgeExtraction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @ManyToOne('Source', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: Relation<Source>;

  @Column({ name: 'transcription_id', type: 'uuid' })
  transcriptionId!: string;

  @ManyToOne('Transcription', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transcription_id' })
  transcription!: Relation<Transcription>;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @Column({
    type: 'enum',
    enum: KnowledgeExtractionStatus,
    enumName: 'knowledge_extraction_status',
    default: KnowledgeExtractionStatus.PENDING,
  })
  status!: KnowledgeExtractionStatus;

  @Column({ name: 'suggested_title', type: 'varchar', length: 512, nullable: true })
  suggestedTitle!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ name: 'payload_json', type: 'jsonb', nullable: true })
  payloadJson!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
