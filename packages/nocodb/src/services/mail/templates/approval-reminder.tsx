import {
  Body,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface ApprovalReminderTemplateProps {
  approverName: string;
  title: string;
  description?: string;
  baseTitle: string;
  tableTitle: string;
  dueDate?: string;
  reminderCount: number;
  link: string;
}

export const ApprovalReminder = ({
  approverName,
  title,
  description,
  baseTitle,
  tableTitle,
  dueDate,
  reminderCount,
  link,
}: ApprovalReminderTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Reminder: Approval request pending - {title}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Approval Reminder
          </Heading>
          <Section className="py-4 mx-auto text-center text-gray-900 text-base">
            <Text className="text-gray-600 text-sm !mt-0 !mb-2">
              Hello <span className="font-bold text-gray-800">{approverName}</span>,
            </Text>
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              This is a friendly reminder (Reminder #{reminderCount}) that you have a pending approval request:
            </Text>
          </Section>

          <Section className="bg-yellow-50 rounded-lg p-4 my-4 border border-yellow-200">
            <Text className="font-bold text-gray-900 text-base !mt-0 !mb-2">
              {title}
            </Text>
            {description && (
              <Text className="text-gray-600 text-sm !mt-0 !mb-2">
                {description}
              </Text>
            )}
            <Text className="text-gray-500 text-xs !mt-2 !mb-0">
              Base: {baseTitle} | Table: {tableTitle}
            </Text>
            {dueDate && (
              <Text className="text-red-600 text-xs font-bold !mt-1 !mb-0">
                ⚠️ Due by: {dueDate}
              </Text>
            )}
          </Section>

          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Review Request</Text>
          </Button>

          <Text className="text-gray-500 text-xs text-center !mt-4 !mb-0">
            Please respond to this approval request as soon as possible to avoid further escalation.
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

ApprovalReminder.PreviewProps = {
  approverName: 'Jane Smith',
  title: 'Q4 Budget Approval',
  description: 'Please review and approve the Q4 budget proposal.',
  baseTitle: 'Finance Management',
  tableTitle: 'Budget Requests',
  dueDate: '2024-12-31',
  reminderCount: 2,
  link: 'https://app.nocodb.com',
};

export default ApprovalReminder;
