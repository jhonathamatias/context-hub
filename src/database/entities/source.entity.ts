import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { SourceStatus, SourceType } from '../enums';
import type { ProcessingJob } from './processing-job.entity';
import type { Transcription } from './transcription.entity';

@Entity({ name: 'sources' })
export class Source {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: SourceType, enumName: 'source_type' })
  type!: SourceType;

  @Column({ name: 'original_name', type: 'varchar', length: 512 })
  originalName!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 1024 })
  storageKey!: string;

  @Column({
    type: 'enum',
    enum: SourceStatus,
    enumName: 'source_status',
    default: SourceStatus.PENDING,
  })
  status!: SourceStatus;

  @OneToMany('ProcessingJob', (job: ProcessingJob) => job.source)
  processingJobs!: Relation<ProcessingJob[]>;

  @OneToMany('Transcription', (transcription: Transcription) => transcription.source)
  transcriptions!: Relation<Transcription[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
