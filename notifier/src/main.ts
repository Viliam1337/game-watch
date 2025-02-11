import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { mikroOrmConfig } from '@game-watch/database';
import { createWorkerForQueue, QueueType } from '@game-watch/queue';
import { createLogger, initializeSentry, parseEnvironment } from '@game-watch/service';
import { MikroORM } from '@mikro-orm/core';
import SendgridMailClient from '@sendgrid/mail';
import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';

import { EnvironmentStructure } from './environment';
import { MailService } from './mail-service';
import { NotificationService } from './notification-service';
import { GameReducedNotificationCreator } from './notifiers/game-reduced-notification-creator';
import { GameReleasedNotificationCreator } from './notifiers/game-released-notification-creator';
import {
    NewMetaCriticRatingNotificationCreator
} from './notifiers/new-meta-critic-rating-notification-creator';
import { NewStoreEntryNotificationCreator } from './notifiers/new-store-entry-notification-creator';
import {
    ReleaseDateChangedNotificationCreator
} from './notifiers/release-date-changed-notification-creator';

const {
    CREATE_NOTIFICATIONS_CONCURRENCY,
    SENDGRID_API_KEY
} = parseEnvironment(EnvironmentStructure, process.env);

initializeSentry('Notifier');

const logger = createLogger('Notifier');

let createNotificationsWorker: Worker | undefined;

SendgridMailClient.setApiKey(SENDGRID_API_KEY);

const notificationCreators = [
    new GameReducedNotificationCreator(),
    new GameReleasedNotificationCreator(),
    new NewMetaCriticRatingNotificationCreator(),
    new NewStoreEntryNotificationCreator(),
    new ReleaseDateChangedNotificationCreator()
];

const mailService = new MailService(SendgridMailClient);

const main = async () => {
    const orm = await MikroORM.init(mikroOrmConfig);

    createNotificationsWorker = createWorkerForQueue(
        QueueType.CreateNotifications,
        async ({ data: { sourceId, existingGameData, resolvedGameData } }) => {
            const sourceScopedLogger = logger.child({ sourceId });

            const notificationService = new NotificationService(
                notificationCreators,
                mailService,
                orm.em.fork(),
                sourceScopedLogger
            );

            try {
                await notificationService.createNotifications({
                    sourceId,
                    existingGameData,
                    resolvedGameData,
                });
            } catch (error) {
                // Need to wrap this because otherwise the error is swallowed by the worker.
                sourceScopedLogger.error(error);
                Sentry.captureException(error, { tags: { sourceId } });
                throw error;
            }
        }, { concurrency: CREATE_NOTIFICATIONS_CONCURRENCY, });

    createNotificationsWorker.on('error', error => {
        logger.error(error);
        Sentry.captureException(error);
    });

    logger.info('Listening for events');
};

main().catch(error => {
    logger.error(error);
    if (createNotificationsWorker) {
        createNotificationsWorker.close();
    }
    process.exit(1);
});
