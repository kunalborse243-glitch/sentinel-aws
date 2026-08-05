import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";
import { type ScanFinding } from "./iam";

export async function scanEc2(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const client = new EC2Client({
    credentials: { accessKeyId, secretAccessKey },
    region,
  });

  try {
    // Scan EC2 instances
    const instancesResp = await client.send(
      new DescribeInstancesCommand({ MaxResults: 100 }),
    );

    for (const reservation of instancesResp.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        const instanceId = instance.InstanceId ?? "unknown";
        const arn = `arn:aws:ec2:${region}::instance/${instanceId}`;
        const nameTag = instance.Tags?.find((t) => t.Key === "Name")?.Value;
        const displayName = nameTag ? `${nameTag} (${instanceId})` : instanceId;

        // Check for public IP
        if (instance.PublicIpAddress) {
          findings.push({
            service: "ec2",
            checkId: "ec2-public-ip",
            title: "EC2 instance has a public IP address",
            description: `Instance "${displayName}" has public IP ${instance.PublicIpAddress} which exposes it directly to the internet.`,
            severity: "medium",
            affectedResource: arn,
            recommendation:
              "Use private subnets with NAT gateways for internet access. Only expose resources via load balancers or bastion hosts.",
            metadataJson: JSON.stringify({ publicIp: instance.PublicIpAddress }),
          });
        }

        // Check for missing IAM role
        if (!instance.IamInstanceProfile) {
          findings.push({
            service: "ec2",
            checkId: "ec2-no-iam-role",
            title: "EC2 instance does not have an IAM instance profile",
            description: `Instance "${displayName}" does not have an IAM instance profile attached. Applications must use hardcoded credentials to access AWS services.`,
            severity: "medium",
            affectedResource: arn,
            recommendation:
              "Assign an IAM instance profile with the minimum required permissions. This allows applications to use temporary credentials via the EC2 metadata service.",
          });
        }

        // Check stopped instances (potential orphaned resources)
        if (instance.State?.Name === "stopped") {
          findings.push({
            service: "ec2",
            checkId: "ec2-instance-stopped",
            title: "EC2 instance has been stopped",
            description: `Instance "${displayName}" is currently stopped. Stopped instances may have associated EBS costs and could represent orphaned resources.`,
            severity: "low",
            affectedResource: arn,
            recommendation:
              "Review stopped instances. Terminate instances that are no longer needed and create AMI snapshots if required.",
            metadataJson: JSON.stringify({ state: instance.State?.Name }),
          });
        }
      }
    }

    // Check for unencrypted EBS volumes
    try {
      const volumesResp = await client.send(
        new DescribeVolumesCommand({ MaxResults: 100 }),
      );
      for (const volume of volumesResp.Volumes ?? []) {
        if (!volume.Encrypted) {
          const nameTag = volume.Tags?.find((t) => t.Key === "Name")?.Value;
          const displayName = nameTag ? `${nameTag} (${volume.VolumeId})` : (volume.VolumeId ?? "unknown");
          findings.push({
            service: "ec2",
            checkId: "ec2-unencrypted-ebs",
            title: "EBS volume is not encrypted",
            description: `EBS volume "${displayName}" is not encrypted at rest. This may expose sensitive data if physical storage is compromised.`,
            severity: "medium",
            affectedResource: `arn:aws:ec2:${region}::volume/${volume.VolumeId}`,
            recommendation:
              "Enable EBS encryption at rest. Enable default EBS encryption in EC2 settings to automatically encrypt all new volumes.",
            metadataJson: JSON.stringify({ volumeId: volume.VolumeId, size: volume.Size }),
          });
        }
      }
    } catch {
      // Skip
    }

    // Scan security groups
    try {
      const sgResp = await client.send(
        new DescribeSecurityGroupsCommand({ MaxResults: 100 }),
      );

      const dangerousPorts = [22, 3389, 3306, 5432, 27017, 6379];
      const portNames: Record<number, string> = {
        22: "SSH",
        3389: "RDP",
        3306: "MySQL",
        5432: "PostgreSQL",
        27017: "MongoDB",
        6379: "Redis",
      };

      for (const sg of sgResp.SecurityGroups ?? []) {
        const sgId = sg.GroupId ?? "unknown";
        const sgName = sg.GroupName ?? sgId;
        const arn = `arn:aws:ec2:${region}::security-group/${sgId}`;

        for (const rule of sg.IpPermissions ?? []) {
          const fromPort = rule.FromPort ?? 0;
          const toPort = rule.ToPort ?? 65535;

          const hasPublicCidr = (rule.IpRanges ?? []).some(
            (r) => r.CidrIp === "0.0.0.0/0",
          ) || (rule.Ipv6Ranges ?? []).some(
            (r) => r.CidrIpv6 === "::/0",
          );

          if (!hasPublicCidr) continue;

          // Check all ports open
          if (fromPort === 0 && toPort === 65535) {
            findings.push({
              service: "security_groups",
              checkId: "sg-all-ports-open",
              title: `Security group "${sgName}" allows all inbound traffic from the internet`,
              description: `Security group "${sgName}" (${sgId}) has an inbound rule allowing all ports from 0.0.0.0/0.`,
              severity: "critical",
              affectedResource: arn,
              recommendation:
                "Remove the all-ports inbound rule. Restrict access to only the specific ports and protocols required.",
            });
            continue;
          }

          // Check dangerous ports
          for (const port of dangerousPorts) {
            if (port >= fromPort && port <= toPort) {
              findings.push({
                service: "security_groups",
                checkId: `sg-port-${port}-open`,
                title: `Security group "${sgName}" allows ${portNames[port] ?? `port ${port}`} from the internet`,
                description: `Security group "${sgName}" (${sgId}) allows inbound ${portNames[port] ?? `port ${port}`} (${port}) from 0.0.0.0/0.`,
                severity: port === 22 || port === 3389 ? "high" : "medium",
                affectedResource: arn,
                recommendation: `Restrict ${portNames[port] ?? `port ${port}`} access to known IP addresses or use VPN/bastion host for administration.`,
                metadataJson: JSON.stringify({ port, sgId, sgName }),
              });
            }
          }
        }
      }
    } catch {
      // Skip
    }
  } catch (err) {
    findings.push({
      service: "ec2",
      checkId: "ec2-scan-error",
      title: "EC2 scan could not complete",
      description: `Failed to complete EC2 scan: ${err instanceof Error ? err.message : String(err)}`,
      severity: "informational",
      affectedResource: `arn:aws:ec2:${region}::`,
      recommendation: "Ensure the IAM user has ec2:Describe* permissions.",
    });
  }

  return findings;
}
