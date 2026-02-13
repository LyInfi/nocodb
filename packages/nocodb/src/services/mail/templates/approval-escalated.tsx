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

interface ApprovalEscalatedTemplateProps {
  newApproverName: string;
  title: string;
  description?: string;
  baseTitle: string;
  tableTitle: string;
  escalationLevel: number;
  previousApproverName?: string;
  reason: string;
  link: string;
}

export const ApprovalEscalated = ({
  newApproverName,
  title,
  description,
  baseTitle,
  tableTitle,
  escalationLevel,
  previousApproverName,
  reason,
  link,
}: ApprovalEscalatedTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Approval escalated to you: {title}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Approval Escalated
          </Heading>
          <Section className="py-4 mx-auto text-center text-gray-900 text-base">
            <Text className="text-gray-600 text-sm !mt-0 !mb-2">
              Hello <span className="font-bold text-gray-800">{newApproverName}</span>,
            </Text>
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              An approval request has been escalated to you (Level {escalationLevel}) due to:
            </Text>
          </Section>

          <Section className="bg-red-50 rounded-lg p-4 my-4 border border-red-200">
            <Text className="text-red-700 text-sm !mt-0 !mb-2 font-semibold">
              Reason: {reason}
            </Text>
            {previousApproverName && (
              <Text className="text-gray-600 text-xs !mt-0 !mb-0">
                Previous approver: {previousApproverName}
              </Text>
            )}
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
          </Section>

          <Button
            className="text-center w-full text-base font-bold bg-brand-500 text-white rounded-lg h-10"
            href={link}
          >
            <Text className="!my-[8px]">Review Request</Text>
          </Button>

          <Text className="text-gray-500 text-xs text-center !mt-4 !mb-0">
            This approval requires your immediate attention as it has been escalated.
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

ApprovalEscalated.PreviewProps = {
  newApproverName: 'Manager Name',
  title: 'Q4 Budget Approval',
  description: 'Please review and approve the Q4 budget proposal.',
  baseTitle: 'Finance Management',
  tableTitle: 'Budget Requests',
  escalationLevel: 2,
  previousApproverName: 'Jane Smith',
  reason: 'No response from previous approver within timeout period',
  link: 'https://app.nocodb.com',
};

export default ApprovalEscalated;
