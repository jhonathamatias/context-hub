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

@Entity({ name: 'sources' })
export class Source {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: SourceType, enumName: 'source_type' })
  type!: SourceType;

  @Column({ type: 'varchar', length: 512 })
  originalName!: string;

  @Column({ type: 'varchar', length: 1024 })
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
