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

interface ApprovalRequestedTemplateProps {
  approverName: string;
  requesterName: string;
  requesterEmail: string;
  title: string;
  description?: string;
  baseTitle: string;
  tableTitle: string;
  dueDate?: string;
  link: string;
}

export const ApprovalRequested = ({
  approverName,
  requesterName,
  requesterEmail,
  title,
  description,
  baseTitle,
  tableTitle,
  dueDate,
  link,
}: ApprovalRequestedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>New approval request: {title}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Approval Request
          </Heading>
          <Section className="py-4 mx-auto text-center text-gray-900 text-base">
            <Text className="text-gray-600 text-sm !mt-0 !mb-2">
              Hello <span className="font-bold text-gray-800">{approverName}</span>,
            </Text>
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              <span className="font-bold text-gray-800">{requesterName}</span> ({requesterEmail})
              has requested your approval for:
            </Text>
          </Section>

          <Section className="bg-gray-50 rounded-lg p-4 my-4">
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
              <Text className="text-orange-600 text-xs !mt-1 !mb-0">
                Due by: {dueDate}
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
            Please review and respond to this approval request at your earliest convenience.
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

ApprovalRequested.PreviewProps = {
  approverName: 'Jane Smith',
  requesterName: 'John Doe',
  requesterEmail: 'john@example.com',
  title: 'Q4 Budget Approval',
  description: 'Please review and approve the Q4 budget proposal.',
  baseTitle: 'Finance Management',
  tableTitle: 'Budget Requests',
  dueDate: '2024-12-31',
  link: 'https://app.nocodb.com',
};

export default ApprovalRequested;
