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

interface ApprovalDecisionTemplateProps {
  requesterName: string;
  approverName: string;
  approverEmail: string;
  title: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  baseTitle: string;
  tableTitle: string;
  link: string;
}

export const ApprovalDecision = ({
  requesterName,
  approverName,
  approverEmail,
  title,
  decision,
  comment,
  baseTitle,
  tableTitle,
  link,
}: ApprovalDecisionTemplateProps) => {
  const isApproved = decision === 'approved';
  const decisionColor = isApproved ? 'text-green-600' : 'text-red-600';
  const decisionBg = isApproved ? 'bg-green-50' : 'bg-red-50';
  const decisionBorder = isApproved ? 'border-green-200' : 'border-red-200';

  return (
    <Html>
      <RootWrapper>
        <Head />
        <Preview>Your approval request was {decision}: {title}</Preview>
        <Body className="bg-white">
          <ContentWrapper>
            <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
              Approval {isApproved ? 'Approved' : 'Rejected'}
            </Heading>
            <Section className="py-4 mx-auto text-center text-gray-900 text-base">
              <Text className="text-gray-600 text-sm !mt-0 !mb-2">
                Hello <span className="font-bold text-gray-800">{requesterName}</span>,
              </Text>
              <Text className="text-gray-600 text-sm !mt-0 !mb-4">
                Your approval request has been reviewed by{' '}
                <span className="font-bold text-gray-800">{approverName}</span> ({approverEmail}):
              </Text>
            </Section>

            <Section className={`${decisionBg} ${decisionBorder} rounded-lg p-4 my-4 border`}>
              <Text className="font-bold text-gray-900 text-base !mt-0 !mb-2">
                {title}
              </Text>
              <Text className={`${decisionColor} font-bold text-sm !mt-0 !mb-2`}>
                Decision: {isApproved ? '✅ APPROVED' : '❌ REJECTED'}
              </Text>
              {comment && (
                <Text className="text-gray-600 text-sm !mt-0 !mb-2">
                  <span className="font-semibold">Comment:</span> {comment}
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
              <Text className="!my-[8px]">View Details</Text>
            </Button>

            <Text className="text-gray-500 text-xs text-center !mt-4 !mb-0">
              {isApproved
                ? 'Your request has been approved. You may proceed with the next steps.'
                : 'Your request was not approved. Please review the comments and consider revising your request.'}
            </Text>
          </ContentWrapper>
          <Footer />
        </Body>
      </RootWrapper>
    </Html>
  );
};

ApprovalDecision.PreviewProps = {
  requesterName: 'John Doe',
  approverName: 'Jane Smith',
  approverEmail: 'jane@example.com',
  title: 'Q4 Budget Approval',
  decision: 'approved',
  comment: 'Looks good! Approved with minor adjustments to marketing budget.',
  baseTitle: 'Finance Management',
  tableTitle: 'Budget Requests',
  link: 'https://app.nocodb.com',
};

export default ApprovalDecision;
