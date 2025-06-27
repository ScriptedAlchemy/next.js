#!/usr/bin/env node

// Sequential Test Runner - NO CONCURRENCY, COMPLETE TEARDOWN AFTER EACH TEST
const { spawn, exec } = require('node:child_process');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

class SequentialTestRunner {
  constructor() {
    this.results = [];
  }

  async run() {
    console.log('🧪 Sequential HMR Test Runner - NO CONCURRENCY');
    console.log('===============================================');
    console.log('Each test starts fresh server → runs test → kills server completely');
    console.log('');

    // Define tests to run sequentially
    const tests = [
      {
        name: 'Working HMR Test (Known Good)',
        command: 'pnpm',
        args: ['test:working'],
        description: 'Original working test that we know passes'
      },
      {
        name: 'Simple Method 1 Test',
        command: 'node',
        args: ['test/simple-method1.test.js'],
        description: 'File-based HMR isolated test'
      },
      {
        name: 'Simple Method 2 Test',
        command: 'node', 
        args: ['test/simple-method2.test.js'],
        description: 'Internal API HMR isolated test'
      },
      {
        name: 'HMR Comparison Test',
        command: 'node',
        args: ['test/hmr-approaches-comparison.test.js'],
        description: 'All methods comparison with server'
      }
    ];

    // Run each test sequentially with complete cleanup
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`\n🔄 Running Test ${i + 1}/${tests.length}: ${test.name}`);
      console.log(`📝 ${test.description}`);
      console.log(''.padEnd(70, '='));

      // Step 1: Complete cleanup before test
      await this.forceCleanup();

      // Step 2: Run the test
      const result = await this.runSingleTest(test);
      this.results.push(result);

      // Show output summary
      if (result.output) {
        console.log('\n📋 Test Output Summary:');
        if (result.output.stdout) {
          const lines = result.output.stdout.split('\n').filter(line => 
            line.includes('Ready in') || 
            line.includes('Local:') || 
            line.includes('✅') || 
            line.includes('❌') ||
            line.includes('GET /')
          );
          if (lines.length > 0) {
            console.log('   Key STDOUT lines:');
            lines.slice(-5).forEach(line => console.log(`     ${line.trim()}`));
          }
        }
        if (result.output.stderr && result.output.stderr.includes('Error')) {
          const errorLines = result.output.stderr.split('\n').filter(line => 
            line.includes('Error') || line.includes('WARN')
          );
          if (errorLines.length > 0) {
            console.log('   Key STDERR lines:');
            errorLines.slice(-3).forEach(line => console.log(`     ${line.trim()}`));
          }
        }
      }

      // Step 3: Complete cleanup after test
      await this.forceCleanup();

      // Step 4: Wait between tests
      if (i < tests.length - 1) {
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.printFinalSummary();
  }

  async forceCleanup() {
    console.log('🧹 FORCE CLEANUP - Killing all Next.js processes...');
    
    const cleanupCommands = [
      'npx kill-port 3000 3001 3002 3003',
      'pkill -f "next dev"',
      'pkill -f "pnpm dev"', 
      'pkill -f "node.*next"',
      'lsof -ti:3000 | xargs kill -9',
      'lsof -ti:3001 | xargs kill -9',
      'lsof -ti:3002 | xargs kill -9',
      'lsof -ti:3003 | xargs kill -9'
    ];

    for (const cmd of cleanupCommands) {
      try {
        await execAsync(cmd);
      } catch (error) {
        // Ignore errors - process might not exist
      }
    }

    // Wait for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Cleanup completed');
  }

  async runSingleTest(test) {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting: ${test.command} ${test.args.join(' ')}`);
      
      // Run the test with timeout
      const result = await this.executeTest(test);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ ${test.name} PASSED (${duration}ms)`);
        return { name: test.name, success: true, duration, output: result.output };
      } else {
        console.log(`❌ ${test.name} FAILED (${duration}ms)`);
        console.log(`   Error: ${result.error}`);
        return { name: test.name, success: false, duration, error: result.error };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${test.name} FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      return { name: test.name, success: false, duration, error: error.message };
    }
  }

  async executeTest(test) {
    return new Promise((resolve) => {
      const childProcess = spawn(test.command, test.args, {
        cwd: __dirname + '/..',
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Show real-time output for important messages
        if (output.includes('✅') || output.includes('❌') || output.includes('Ready in') || output.includes('Starting')) {
          console.log(`   ${output.trim()}`);
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Show real-time stderr for errors
        if (output.includes('Error') || output.includes('WARNING') || output.includes('WARN')) {
          console.log(`   STDERR: ${output.trim()}`);
        }
      });

      // Set timeout for each test (5 minutes max)
      const timeout = setTimeout(() => {
        console.log('⏰ Test timeout - killing process...');
        try {
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 2000);
        } catch (e) {
          // Process may already be dead
        }
        resolve({ 
          success: false, 
          error: 'Test timeout (5 minutes)', 
          output: { stdout, stderr } 
        });
      }, 300000);

      childProcess.on('close', (code, signal) => {
        clearTimeout(timeout);
        console.log(`   Process closed with code: ${code}, signal: ${signal}`);
        resolve({
          success: code === 0,
          error: code !== 0 ? `Exit code: ${code}${signal ? `, signal: ${signal}` : ''}` : null,
          output: { stdout, stderr }
        });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`   Process error: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          output: { stdout, stderr }
        });
      });

      // Handle process cleanup on interruption
      process.on('SIGINT', () => {
        clearTimeout(timeout);
        try {
          childProcess.kill('SIGTERM');
        } catch (e) {
          // Process may already be dead
        }
      });
    });
  }

  printFinalSummary() {
    console.log('\n📊 FINAL SEQUENTIAL TEST RESULTS');
    console.log('==================================');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`Total Tests Run: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log('');

    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      console.log(`${index + 1}. ${status} ${result.name} (${duration})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('');
    console.log(`🎯 Final Result: ${passed}/${total} tests passed`);
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log(`⚠️  ${failed} test(s) failed`);
    }

    // Final cleanup
    this.forceCleanup().then(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

// Handle interruption
process.on('SIGINT', async () => {
  console.log('\n🛑 Test runner interrupted - force cleanup...');
  const runner = new SequentialTestRunner();
  await runner.forceCleanup();
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  const runner = new SequentialTestRunner();
  runner.run().catch(async (error) => {
    console.error('❌ Test runner failed:', error);
    const cleanup = new SequentialTestRunner();
    await cleanup.forceCleanup();
    process.exit(1);
  });
}

module.exports = SequentialTestRunner;