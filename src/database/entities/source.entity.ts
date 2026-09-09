import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SourceStatus, SourceType } from '../enums';
import { ProcessingJob } from './processing-job.entity';
import { Transcription } from './transcription.entity';

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

  @OneToMany(() => ProcessingJob, (job) => job.source)
  processingJobs!: ProcessingJob[];

  @OneToMany(() => Transcription, (transcription) => transcription.source)
  transcriptions!: Transcription[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
