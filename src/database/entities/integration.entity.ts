import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IntegrationKind } from '../enums';

export type IntegrationMetadata = {
  shareUrl?: string;
};

@Entity({ name: 'integrations' })
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: IntegrationKind, enumName: 'integration_kind' })
  kind!: IntegrationKind;

  @Column({ type: 'varchar', length: 256 })
  name!: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: IntegrationMetadata | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
